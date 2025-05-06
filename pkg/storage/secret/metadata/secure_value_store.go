package metadata

import (
	"context"
	"fmt"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var _ contracts.SecureValueMetadataStorage = (*secureValueMetadataStorage)(nil)

func ProvideSecureValueMetadataStorage(db contracts.Database, features featuremgmt.FeatureToggles) (contracts.SecureValueMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &secureValueMetadataStorage{}, nil
	}

	return &secureValueMetadataStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
	}, nil
}

// secureValueMetadataStorage is the actual implementation of the secure value (metadata) storage.
type secureValueMetadataStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
}

func (s *secureValueMetadataStorage) Create(ctx context.Context, sv *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	sv.Status.Phase = secretv0alpha1.SecureValuePhasePending
	sv.Status.Message = ""

	row, err := toCreateRow(sv, actorUID)
	if err != nil {
		return nil, fmt.Errorf("to create row: %w", err)
	}

	req := createSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
	}

	query, err := sqltemplate.Execute(sqlSecureValueCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlSecureValueCreate.Name(), err)
	}

	err = s.db.Transaction(ctx, func(ctx context.Context) error {
		if row.Keeper.Valid {
			// Validate before inserting that the chosen `keeper` exists.

			// -- This is a copy of KeeperMetadataStore.read, which is not public at the moment, and is not defined in contract.KeeperMetadataStorage
			req := &readKeeper{
				SQLTemplate: sqltemplate.New(s.dialect),
				Namespace:   row.Namespace,
				Name:        row.Keeper.String,
				IsForUpdate: true,
			}

			query, err := sqltemplate.Execute(sqlKeeperRead, req)
			if err != nil {
				return fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
			}

			res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
			if err != nil {
				return fmt.Errorf("getting row: %w", err)
			}
			defer func() { _ = res.Close() }()

			if !res.Next() {
				return contracts.ErrKeeperNotFound
			}
		}

		res, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("inserting row: %w", err)
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, row.Name, row.Namespace)
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

func (s *secureValueMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv0alpha1.SecureValue, error) {
	secureValue, err := s.read(ctx, namespace, name, opts)
	if err != nil {
		return nil, err
	}

	secureValueKub, err := secureValue.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValueKub, nil
}

func (s *secureValueMetadataStorage) Update(ctx context.Context, newSecureValue *secretv0alpha1.SecureValue, actorUID string) (*secretv0alpha1.SecureValue, error) {
	currentRow := &secureValueDB{Name: newSecureValue.Name, Namespace: newSecureValue.Namespace}

	read, err := s.Read(ctx, xkube.Namespace(newSecureValue.Namespace), newSecureValue.Name, contracts.ReadOpts{})
	if err != nil || read == nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	newRow, err := toUpdateRow(currentRow, newSecureValue, actorUID, currentRow.ExternalID)
	if err != nil {
		return nil, fmt.Errorf("to update row: %w", err)
	}

	err = s.db.Transaction(ctx, func(ctx context.Context) error {
		if newRow.Keeper.Valid {
			// Validate before updating that the new `keeper` exists.

			// -- This is a copy of KeeperMetadataStore.read, which is not public at the moment, and is not defined in contract.KeeperMetadataStorage
			req := &readKeeper{
				SQLTemplate: sqltemplate.New(s.dialect),
				Namespace:   newRow.Namespace,
				Name:        newRow.Keeper.String,
				IsForUpdate: true,
			}

			query, err := sqltemplate.Execute(sqlKeeperRead, req)
			if err != nil {
				return fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
			}

			res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
			if err != nil {
				return fmt.Errorf("getting row: %w", err)
			}
			defer func() { _ = res.Close() }()

			if !res.Next() {
				return contracts.ErrKeeperNotFound
			}
		}

		req := &updateSecureValue{
			SQLTemplate: sqltemplate.New(s.dialect),
			Namespace:   newRow.Namespace,
			Name:        newRow.Name,
			Row:         nil,
		}

		query, err := sqltemplate.Execute(sqlSecureValueUpdate, req)
		if err != nil {
			return fmt.Errorf("execute template %q: %w", sqlSecureValueUpdate.Name(), err)
		}

		result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("updating row: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, newRow.Name, newRow.Namespace)
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
	req := deleteSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlSecureValueDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueDelete.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
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

	rows, err := s.db.QueryContext(ctx, q, req.GetArgs()...)
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

	res, err := s.db.ExecContext(ctx, q, req.GetArgs()...)
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

func (s *secureValueMetadataStorage) SetStatus(ctx context.Context, namespace xkube.Namespace, name string, status secretv0alpha1.SecureValueStatus) error {
	req := updateStatusSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Phase:       string(status.Phase),
	}

	q, err := sqltemplate.Execute(sqlSecureValueUpdateStatus, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueUpdateStatus.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, q, req.GetArgs()...)
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
	row, err := s.read(ctx, namespace, name, contracts.ReadOpts{})
	if err != nil {
		return nil, err
	}

	secureValue, err := row.toDecrypt()
	if err != nil {
		return nil, fmt.Errorf("convert to kubernetes object: %w", err)
	}

	return secureValue, nil
}

func (s *secureValueMetadataStorage) read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (secureValueDB, error) {
	req := readSecureValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		IsForUpdate: opts.ForUpdate,
	}

	query, err := sqltemplate.Execute(sqlSecureValueRead, req)
	if err != nil {
		return secureValueDB{}, fmt.Errorf("execute template %q: %w", sqlSecureValueRead.Name(), err)
	}

	res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return secureValueDB{}, fmt.Errorf("reading row: %w", err)
	}
	defer func() { _ = res.Close() }()

	var secureValue secureValueDB
	if !res.Next() {
		return secureValueDB{}, contracts.ErrSecureValueNotFound
	}

	if err := res.Scan(
		&secureValue.GUID, &secureValue.Name, &secureValue.Namespace,
		&secureValue.Annotations, &secureValue.Labels,
		&secureValue.Created, &secureValue.CreatedBy,
		&secureValue.Updated, &secureValue.UpdatedBy,
		&secureValue.Phase, &secureValue.Message,
		&secureValue.Description, &secureValue.Keeper, &secureValue.Decrypters, &secureValue.Ref, &secureValue.ExternalID); err != nil {
		return secureValueDB{}, fmt.Errorf("failed to scan secure value row: %w", err)
	}

	if err := res.Err(); err != nil {
		return secureValueDB{}, fmt.Errorf("read rows error: %w", err)
	}
	return secureValue, nil
}
