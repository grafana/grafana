package metadata

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
)

func ProvideSecureValueMetadataStorage(
	db db.DB,
	features featuremgmt.FeatureToggles,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService secretkeeper.Service) (contracts.SecureValueMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &secureValueMetadataStorage{}, nil
	}

	// Pass `cfg` as `nil` because it is not used. If it ends up being used, it will panic.
	// This is intended, as we shouldn't need any configuration settings here for secrets migrations.
	if err := migrator.MigrateSecretSQL(db.GetEngine(), nil); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	keepers, err := keeperService.GetKeepers()
	if err != nil {
		return nil, fmt.Errorf("getting keepers from keeper service: %+w", err)
	}

	return &secureValueMetadataStorage{
		db:                    db,
		keeperMetadataStorage: keeperMetadataStorage,
		keepers:               keepers,
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	db                    db.DB
	keeperMetadataStorage contracts.KeeperMetadataStorage
	keepers               map[contracts.KeeperType]contracts.Keeper
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	sv.Status.Phase = secretv0alpha1.SecureValuePhasePending
	sv.Status.Message = ""

	row, err := toCreateRow(sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("to create row: %w", err)
	}

	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			if row.Keeper != contracts.DefaultSQLKeeper {
				// Validate before inserting that the chosen `keeper` exists.
				keeperRow := &keeperDB{Name: row.Keeper, Namespace: row.Namespace}

				keeperExists, err := sess.Table(keeperRow.TableName()).ForUpdate().Exist(keeperRow)
				if err != nil {
					return fmt.Errorf("checking keeper existence: %w", err)
				}

				if !keeperExists {
					return contracts.ErrKeeperNotFound
				}
			}

			if _, err := sess.Insert(row); err != nil {
				if s.db.GetDialect().IsUniqueConstraintViolation(err) {
					return fmt.Errorf("namespace=%s name=%s %w", row.Namespace, row.Name, contracts.ErrSecureValueAlreadyExists)
				}
				return fmt.Errorf("inserting row: %w", err)
			}

			return nil
		})
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdSecureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return createdSecureValue, nil
}

func (s *secureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.SecureValue, error) {
	row := &secureValueDB{Name: name, Namespace: namespace.String()}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(row)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return contracts.ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValue, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

func (s *secureValueMetadataStorage) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	currentRow := &secureValueDB{Name: newSecureValue.Name, Namespace: newSecureValue.Namespace}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(currentRow)
		if err != nil {
			return fmt.Errorf("could not get row: %w", err)
		}

		if !found {
			return contracts.ErrSecureValueNotFound
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	// TODO: Remove once the outbox is implemented, as the status will be set to `Succeeded` by a separate process.
	// Temporarily mark succeeded here since the value is already stored in the keeper.
	newSecureValue.Status.Phase = secretv0alpha1.SecureValuePhaseSucceeded
	newSecureValue.Status.Message = ""

	newRow, err := toUpdateRow(currentRow, newSecureValue, actorUID, currentRow.ExternalID)
	if err != nil {
		return nil, fmt.Errorf("to update row: %w", err)
	}

	err = s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if newRow.Keeper != contracts.DefaultSQLKeeper {
			// Validate before updating that the new `keeper` exists.
			keeperRow := &keeperDB{Name: newRow.Keeper, Namespace: newRow.Namespace}

			keeperExists, err := sess.Table(keeperRow.TableName()).ForUpdate().Exist(keeperRow)
			if err != nil {
				return fmt.Errorf("check keeper existence: %w", err)
			}

			if !keeperExists {
				return contracts.ErrKeeperNotFound
			}
		}

		cond := &secureValueDB{Name: newSecureValue.Name, Namespace: newSecureValue.Namespace}

		if _, err := sess.Update(newRow, cond); err != nil {
			return fmt.Errorf("update row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValue, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

func (s *secureValueMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	// TODO: do we need to delete by GUID? name+namespace is a unique index. It would avoid doing a fetch.
	row := &secureValueDB{Name: name, Namespace: namespace.String()}

	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		// TODO: because this is a securevalue, do we care to inform the caller if a row was delete (existed) or not?
		if _, err := sess.Delete(row); err != nil {
			return fmt.Errorf("delete row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) ([]secretv0alpha1.SecureValue, error) {
	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}
	fieldSelector := options.FieldSelector
	if fieldSelector == nil {
		fieldSelector = fields.Everything()
	}

	secureValueRows := make([]*secureValueDB, 0)

	if err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		cond := &secureValueDB{Namespace: namespace.String()}

		if err := sess.Find(&secureValueRows, cond); err != nil {
			return fmt.Errorf("find rows: %w", err)
		}

		return nil
	}); err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValues := make([]secretv0alpha1.SecureValue, 0, len(secureValueRows))

	for _, row := range secureValueRows {

		secureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		if labelSelector.Matches(labels.Set(secureValue.Labels)) {
			if fieldSelector.Matches(fields.Set{
				"status.phase": string(secureValue.Status.Phase),
			}) {
				secureValues = append(secureValues, *secureValue)
			}
		}
	}

	return secureValues, nil
}

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	return s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			modifiedCount, err := sess.Table(migrator.TableNameSecureValue).
				Where("namespace = ? AND name = ?", namespace.String(), name).
				Cols("external_id").
				Update(&secureValueDB{ExternalID: externalID.String()})

			if modifiedCount > 1 {
				return fmt.Errorf("secureValueMetadataStorage.SetExternalID: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
			}

			if err != nil {
				return fmt.Errorf("setting secure value external id: namespace=%+v name=%+v externalID=%+v %w", namespace, name, externalID, err)
			}

			return nil
		})
	})
}

func (s *secureValueMetadataStorage) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	return s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			modifiedCount, err := sess.Table(migrator.TableNameSecureValue).
				Where("namespace = ? AND name = ?", namespace.String(), name).
				Cols("status_phase").
				Update(&secureValueDB{Phase: string(secretv0alpha1.SecureValuePhaseSucceeded)})

			if modifiedCount > 1 {
				return fmt.Errorf("secureValueMetadataStorage.SetStatusSucceeded: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
			}

			if err != nil {
				return fmt.Errorf("setting secure value status to Succeeded id: namespace=%+v name=%+v %w", namespace, name, err)
			}

			return nil
		})
	})
}
