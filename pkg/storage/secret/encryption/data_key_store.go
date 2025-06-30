package encryption

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

// encryptionStoreImpl is the actual implementation of the data key storage.
type encryptionStoreImpl struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
	log     log.Logger
}

func ProvideDataKeyStorage(
	db contracts.Database,
	tracer trace.Tracer,
	features featuremgmt.FeatureToggles,
	registerer prometheus.Registerer,
) (contracts.DataKeyStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptionStoreImpl{}, nil
	}

	store := &encryptionStoreImpl{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
		log:     log.New("encryption.store"),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*contracts.SecretDataKey, error) {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.GetDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("uid", uid),
	))
	defer span.End()

	req := readDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		UID:         uid,
	}

	query, err := sqltemplate.Execute(sqlDataKeyRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyRead.Name(), err)
	}

	res, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting data key row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrDataKeyNotFound
	}

	var dataKey SecretDataKey
	err = res.Scan(
		&dataKey.UID,
		&dataKey.Namespace,
		&dataKey.Label,
		&dataKey.Provider,
		&dataKey.EncryptedData,
		&dataKey.Active,
		&dataKey.Created,
		&dataKey.Updated,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan data key row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.SecretDataKey{
		UID:           dataKey.UID,
		Namespace:     dataKey.Namespace,
		Label:         dataKey.Label,
		Provider:      dataKey.Provider,
		EncryptedData: dataKey.EncryptedData,
		Active:        dataKey.Active,
		Created:       dataKey.Created,
		Updated:       dataKey.Updated,
	}, nil
}

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*contracts.SecretDataKey, error) {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.GetCurrentDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("label", label),
	))
	defer span.End()

	req := readCurrentDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		Label:       label,
	}

	query, err := sqltemplate.Execute(sqlDataKeyReadCurrent, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyReadCurrent.Name(), err)
	}

	res, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting current data key row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrDataKeyNotFound
	}

	var dataKey SecretDataKey
	err = res.Scan(
		&dataKey.UID,
		&dataKey.Namespace,
		&dataKey.Label,
		&dataKey.Provider,
		&dataKey.EncryptedData,
		&dataKey.Active,
		&dataKey.Created,
		&dataKey.Updated,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan data key row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.SecretDataKey{
		UID:           dataKey.UID,
		Namespace:     dataKey.Namespace,
		Label:         dataKey.Label,
		Provider:      dataKey.Provider,
		EncryptedData: dataKey.EncryptedData,
		Active:        dataKey.Active,
		Created:       dataKey.Created,
		Updated:       dataKey.Updated,
	}, nil
}

func (ss *encryptionStoreImpl) GetAllDataKeys(ctx context.Context, namespace string) ([]*contracts.SecretDataKey, error) {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.GetAllDataKeys", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	req := listDataKeys{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
	}

	query, err := sqltemplate.Execute(sqlDataKeyList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyList.Name(), err)
	}

	rows, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing data keys %q: %w", sqlDataKeyList.Name(), err)
	}
	defer func() { _ = rows.Close() }()

	dataKeys := make([]*contracts.SecretDataKey, 0)
	for rows.Next() {
		var row SecretDataKey
		err = rows.Scan(
			&row.UID,
			&row.Namespace,
			&row.Label,
			&row.Provider,
			&row.EncryptedData,
			&row.Active,
			&row.Created,
			&row.Updated,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading data key row: %w", err)
		}

		dataKeys = append(dataKeys, &contracts.SecretDataKey{
			UID:           row.UID,
			Namespace:     row.Namespace,
			Label:         row.Label,
			Provider:      row.Provider,
			EncryptedData: row.EncryptedData,
			Active:        row.Active,
			Created:       row.Created,
			Updated:       row.Updated,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return dataKeys, nil
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *contracts.SecretDataKey) error {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.CreateDataKey", trace.WithAttributes(
		attribute.String("uid", dataKey.UID),
		attribute.String("namespace", dataKey.Namespace),
		attribute.Bool("active", dataKey.Active),
	))
	defer span.End()

	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	req := createDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Row:         dataKey,
	}

	query, err := sqltemplate.Execute(sqlDataKeyCreate, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyCreate.Name(), err)
	}

	result, err := ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("inserting data key row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, but affected %d", rowsAffected)
	}

	return nil
}

func (ss *encryptionStoreImpl) DisableDataKeys(ctx context.Context, namespace string) error {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.DisableDataKeys", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer span.End()

	req := disableDataKeys{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		Updated:     time.Now(),
	}

	query, err := sqltemplate.Execute(sqlDataKeyDisable, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyDisable.Name(), err)
	}

	result, err := ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("updating data key row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, but affected %d", rowsAffected)
	}

	return nil
}

func (ss *encryptionStoreImpl) DeleteDataKey(ctx context.Context, namespace, uid string) error {
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.DeleteDataKey", trace.WithAttributes(
		attribute.String("uid", uid),
		attribute.String("namespace", namespace),
	))
	defer span.End()

	if len(uid) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	req := deleteDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		UID:         uid,
	}

	query, err := sqltemplate.Execute(sqlDataKeyDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyDelete.Name(), err)
	}

	result, err := ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("deleting data key is %s in namespace %s: %w", uid, namespace, err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("bug: deleted more than one row from the data key table, should delete only one at a time: deleted=%v", rowsAffected)
	}

	return nil
}
