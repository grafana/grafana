package metadata

import (
	"context"
	"fmt"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	accessClient claims.AccessClient,
	keeperService secretkeeper.Service,
	keeperMetadataStorage contracts.KeeperMetadataStorage) (contracts.SecureValueMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &secureValueMetadataStorage{}, nil
	}

	// Pass `cfg` as `nil` because it is not used. If it ends up being used, it will panic.
	// This is intended, as we shouldn't need any configuration settings here for secrets migrations.
	if err := migrator.MigrateSecretSQL(db.GetEngine(), nil); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	keepers := keeperService.GetKeepers()

	return &secureValueMetadataStorage{
		db:                    db,
		accessClient:          accessClient,
		keepers:               keepers,
		keeperMetadataStorage: keeperMetadataStorage,
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	db                    db.DB
	accessClient          claims.AccessClient
	keepers               map[contracts.KeeperType]contracts.Keeper
	keeperMetadataStorage contracts.KeeperMetadataStorage
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	sv.Status.Phase = secretv0alpha1.SecureValuePhasePending
	sv.Status.Message = ""

	row, err := toCreateRow(sv, authInfo.GetUID())
	if err != nil {
		return nil, fmt.Errorf("to create row: %w", err)
	}

	err = s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if row.Keeper != contracts.DefaultSQLKeeper {
			// Validate before inserting that the chosen `keeper` exists.
			keeperRow := &keeperDB{Name: row.Keeper, Namespace: row.Namespace}

			keeperExists, err := sess.Table(keeperRow.TableName()).ForUpdate().Exist(keeperRow)
			if err != nil {
				return fmt.Errorf("check keeper existence: %w", err)
			}

			if !keeperExists {
				return contracts.ErrKeeperNotFound
			}
		}

		if _, err := sess.Insert(row); err != nil {
			return fmt.Errorf("insert row: %w", err)
		}

		return nil
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
	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

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

func (s *secureValueMetadataStorage) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

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

	// Update in keeper.
	// TODO: here temporary, the moment of update will change in the async flow.
	err = s.updateInKeeper(ctx, currentRow, newSecureValue)
	if err != nil {
		return nil, fmt.Errorf("failed to update in keeper: %w", err)
	}

	// From this point on, we should not have a need to read value.
	newSecureValue.Spec.Value = ""

	// TODO: Remove once the outbox is implemented, as the status will be set to `Succeeded` by a separate process.
	// Temporarily mark succeeded here since the value is already stored in the keeper.
	newSecureValue.Status.Phase = secretv0alpha1.SecureValuePhaseSucceeded
	newSecureValue.Status.Message = ""

	newRow, err := toUpdateRow(currentRow, newSecureValue, authInfo.GetUID(), currentRow.ExternalID)
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
	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	// Delete from the keeper.
	// TODO: here temporary, the moment of deletion will change in the async flow.
	// TODO: do we care to inform the caller if there is any error?
	_ = s.deleteFromKeeper(ctx, namespace, name)

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

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.SecureValueList, error) {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv0alpha1.GROUP,
		Resource:  secretv0alpha1.SecureValuesResourceInfo.GetName(),
		Namespace: namespace.String(),
		Verb:      utils.VerbGet, // Why not VerbList?
	})
	if err != nil {
		return nil, fmt.Errorf("failed to compile checker: %w", err)
	}

	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}
	fieldSelector := options.FieldSelector
	if fieldSelector == nil {
		fieldSelector = fields.Everything()
	}

	secureValueRows := make([]*secureValueDB, 0)

	err = s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		cond := &secureValueDB{Namespace: namespace.String()}

		if err := sess.Find(&secureValueRows, cond); err != nil {
			return fmt.Errorf("find rows: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	secureValues := make([]secretv0alpha1.SecureValue, 0, len(secureValueRows))

	for _, row := range secureValueRows {
		// Check whether the user has permission to access this specific SecureValue in the namespace.
		if !hasPermissionFor(row.Name, "") {
			continue
		}

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

	return &secretv0alpha1.SecureValueList{
		Items: secureValues,
	}, nil
}

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	panic("TODO: secureValueMetadataStorage.SetExternalID")
}

func (s *secureValueMetadataStorage) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	panic("TODO: secureValueMetadataStorage.SetStatusSucceeded")
}
