package metadata

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ contracts.SecureValueMetadataStorage = (*secureValueMetadataStorage)(nil)

func ProvideSecureValueMetadataStorage(
	db db.DB,
	features featuremgmt.FeatureToggles,
) (contracts.SecureValueMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &secureValueMetadataStorage{}, nil
	}

	// Pass `cfg` as `nil` because it is not used. If it ends up being used, it will panic.
	// This is intended, as we shouldn't need any configuration settings here for secrets migrations.
	if err := migrator.MigrateSecretSQL(db.GetEngine(), nil); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return &secureValueMetadataStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(string(db.GetDBType())),
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	db      db.DB
	dialect sqltemplate.Dialect
}

// TODO LND Implement this with sqlx
func (s *secureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	sv.Status.Phase = secretv0alpha1.SecureValuePhasePending
	sv.Status.Message = ""

	row, err := toCreateRow(sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("to create row: %w", err)
	}

	err = s.db.InTransaction(ctx, func(ctx context.Context) error {
		return s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
			if row.Keeper != nil {
				// Validate before inserting that the chosen `keeper` exists.
				keeperRow := &keeperDB{Name: *row.Keeper, Namespace: row.Namespace}

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
	req := readSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlSecureValueRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueRead.Name(), err)
	}

	res, err := s.db.GetSqlxSession().Query(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("reading row: %w", err)
	}
	defer func() { _ = res.Close() }()

	var secureValue secureValueDB
	if res.Next() {
		err := res.Scan(&secureValue.GUID,
			&secureValue.Name, &secureValue.Namespace, &secureValue.Annotations,
			&secureValue.Labels,
			&secureValue.Created, &secureValue.CreatedBy,
			&secureValue.Updated, &secureValue.UpdatedBy,
			&secureValue.Phase, &secureValue.Message,
			&secureValue.Description, &secureValue.Keeper, &secureValue.Decrypters, &secureValue.Ref, &secureValue.ExternalID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan secure value row: %w", err)
		}
	}

	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	secureValueKub, err := secureValue.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValueKub, nil
}

// TODO LND Implement this with sqlx
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

	// From this point on, we should not have a need to read value.
	newSecureValue.Spec.Value = ""

	// TODO: Remove once the outbox is implemented, as the status will be set to `Succeeded` by a separate process.
	// Temporarily mark succeeded here since the value is already stored in the keeper.
	newSecureValue.Status.Phase = secretv0alpha1.SecureValuePhaseSucceeded
	newSecureValue.Status.Message = ""

	newRow, err := toUpdateRow(currentRow, newSecureValue, actorUID, currentRow.ExternalID)
	if err != nil {
		return nil, fmt.Errorf("to update row: %w", err)
	}

	err = s.db.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		if newRow.Keeper != nil {
			// Validate before updating that the new `keeper` exists.
			keeperRow := &keeperDB{Name: *newRow.Keeper, Namespace: newRow.Namespace}

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
	req := deleteSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlSecureValueDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueDelete.Name(), err)
	}

	// TODO: because this is a securevalue, do we care to inform the caller if a row was delete (existed) or not?
	res, err := s.db.GetSqlxSession().Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting secure value row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil || rowsAffected != 1 {
		return fmt.Errorf("deleting secure value rowsAffected=%d error=%w", rowsAffected, err)
	}

	return nil
}

func (s *secureValueMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.SecureValue, error) {
	req := listSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	q, err := sqltemplate.Execute(sqlSecureValueList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueList.Name(), err)
	}

	rows, err := s.db.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing secure values: %w", err)
	}
	defer func() { _ = rows.Close() }()

	secureValues := make([]secretv0alpha1.SecureValue, 0)
	for rows.Next() {
		row := secureValueDB{}

		err = rows.Scan(&row.GUID,
			&row.Name, &row.Namespace, &row.Annotations,
			&row.Labels,
			&row.Created, &row.CreatedBy,
			&row.Updated, &row.UpdatedBy,
			&row.Phase, &row.Message,
			&row.Description, &row.Keeper, &row.Decrypters,
			&row.Ref, &row.ExternalID,
		)

		if err != nil {
			return nil, fmt.Errorf("error reading secure value row: %w", err)
		}

		secureValue, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("convert to kubernetes object: %w", err)
		}

		secureValues = append(secureValues, *secureValue)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return secureValues, nil
}

func (s *secureValueMetadataStorage) SetExternalID(ctx context.Context, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	req := updateExternalIdSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		ExternalID:  externalID.String(),
	}

	q, err := sqltemplate.Execute(sqlSecureValueUpdateExternalId, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueUpdateExternalId.Name(), err)
	}

	res, err := s.db.GetSqlxSession().Exec(ctx, q, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("setting secure value external id: namespace=%+v name=%+v externalID=%+v %w", namespace, name, externalID, err)
	}

	// validate modified cound
	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting updated rows update external id secure value: %w", err)
	}
	if modifiedCount > 1 {
		return fmt.Errorf("secureValueMetadataStorage.SetExternalID: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
	}
	return nil
}

func (s *secureValueMetadataStorage) SetStatusSucceeded(ctx context.Context, namespace xkube.Namespace, name string) error {
	req := updateStatusSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Phase:       string(secretv0alpha1.SecureValuePhaseSucceeded),
	}

	q, err := sqltemplate.Execute(sqlSecureValueUpdateStatus, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueUpdateStatus.Name(), err)
	}

	res, err := s.db.GetSqlxSession().Exec(ctx, q, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("setting secure value status to Succeeded id: namespace=%+v name=%+v %w", namespace, name, err)
	}

	// validate modified cound
	modifiedCount, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting updated rows update status secure value: %w", err)
	}
	if modifiedCount > 1 {
		return fmt.Errorf("secureValueMetadataStorage.SetExternalID: modified more than one secret, this is a bug, check the where condition: modifiedCount=%d", modifiedCount)
	}
	return nil
}

func (s *secureValueMetadataStorage) ReadForDecrypt(ctx context.Context, namespace xkube.Namespace, name string) (*contracts.DecryptSecureValue, error) {
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

	secureValue, err := row.toDecrypt()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}
