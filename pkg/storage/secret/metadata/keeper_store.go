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

// keeperMetadataStorage is the actual implementation of the keeper metadata storage.
type keeperMetadataStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
}

var _ contracts.KeeperMetadataStorage = (*keeperMetadataStorage)(nil)

func ProvideKeeperMetadataStorage(db contracts.Database, features featuremgmt.FeatureToggles) (contracts.KeeperMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &keeperMetadataStorage{}, nil
	}

	return &keeperMetadataStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
	}, nil
}

func (s *keeperMetadataStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper, actorUID string) (*secretv0alpha1.Keeper, error) {
	row, err := toKeeperCreateRow(keeper, actorUID)
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	req := createKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
	}

	query, err := sqltemplate.Execute(sqlKeeperCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperCreate.Name(), err)
	}

	err = s.db.Transaction(ctx, func(ctx context.Context) error {
		result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("inserting row: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("getting rows affected: %w", err)
		}

		if rowsAffected != 1 {
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, keeper.Name, keeper.Namespace)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdKeeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *keeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv0alpha1.Keeper, error) {
	keeperDB, err := s.read(ctx, namespace.String(), name, opts)
	if err != nil {
		return nil, err
	}

	keeper, err := keeperDB.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) read(ctx context.Context, namespace, name string, opts contracts.ReadOpts) (*keeperDB, error) {
	req := &readKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
		Name:        name,
		IsForUpdate: opts.ForUpdate,
	}

	query, err := sqltemplate.Execute(sqlKeeperRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
	}

	res, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting row for %s in namespace %s: %w", name, namespace, err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrKeeperNotFound
	}

	var keeper keeperDB
	err = res.Scan(
		&keeper.GUID, &keeper.Name, &keeper.Namespace, &keeper.Annotations, &keeper.Labels, &keeper.Created,
		&keeper.CreatedBy, &keeper.Updated, &keeper.UpdatedBy, &keeper.Description, &keeper.Type, &keeper.Payload,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan keeper row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &keeper, nil
}

func (s *keeperMetadataStorage) Update(ctx context.Context, newKeeper *secretv0alpha1.Keeper, actorUID string) (*secretv0alpha1.Keeper, error) {
	var newRow *keeperDB

	err := s.db.Transaction(ctx, func(ctx context.Context) error {
		// Read old value first.
		oldKeeperRow, err := s.read(ctx, newKeeper.Namespace, newKeeper.Name, contracts.ReadOpts{ForUpdate: true})
		if err != nil {
			return err
		}

		// Generate an update row model.
		var updateErr error
		newRow, updateErr = toKeeperUpdateRow(oldKeeperRow, newKeeper, actorUID)
		if updateErr != nil {
			return fmt.Errorf("failed to map into update row: %w", updateErr)
		}

		// Update query with new model.
		req := &updateKeeper{
			SQLTemplate: sqltemplate.New(s.dialect),
			Row:         newRow,
		}

		query, err := sqltemplate.Execute(sqlKeeperUpdate, req)
		if err != nil {
			return fmt.Errorf("execute template %q: %w", sqlKeeperUpdate.Name(), err)
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
			return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, newKeeper.Name, newKeeper.Namespace)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	req := deleteKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	query, err := sqltemplate.Execute(sqlKeeperDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlKeeperDelete.Name(), err)
	}

	result, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return contracts.ErrKeeperNotFound
	} else if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d for %s on %s", rowsAffected, name, namespace)
	}

	return nil
}

func (s *keeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace) ([]secretv0alpha1.Keeper, error) {
	req := listKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	query, err := sqltemplate.Execute(sqlKeeperList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperList.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing keepers %q: %w", sqlKeeperList.Name(), err)
	}
	defer func() { _ = rows.Close() }()

	keepers := make([]secretv0alpha1.Keeper, 0)

	for rows.Next() {
		var row keeperDB
		err = rows.Scan(
			&row.GUID, &row.Name, &row.Namespace, &row.Annotations, &row.Labels, &row.Created,
			&row.CreatedBy, &row.Updated, &row.UpdatedBy, &row.Description, &row.Type, &row.Payload,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading keeper row: %w", err)
		}

		keeper, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
		}

		keepers = append(keepers, *keeper)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return keepers, nil
}

func (s *keeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name *string, opts contracts.ReadOpts) (secretv0alpha1.KeeperConfig, error) {
	// Check if keeper is the systemwide one.
	if name == nil {
		return nil, nil
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	kp, err := s.read(ctx, namespace, *name, opts)
	if err != nil {
		return nil, err
	}

	keeperConfig := toProvider(secretv0alpha1.KeeperType(kp.Type), kp.Payload)

	// TODO: this would be a good place to check if credentials are secure values and load them.
	return keeperConfig, nil
}
