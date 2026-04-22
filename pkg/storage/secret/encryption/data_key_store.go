package encryption

import (
	"context"
	"fmt"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/secret/database"
)

const tableDataKey = "secret_data_key"

var dataKeyColumns = []string{
	"uid", "namespace", "label", "provider", "encrypted_data", "active", "created", "updated",
}

// encryptionStoreImpl is the actual implementation of the data key storage.
type encryptionStoreImpl struct {
	db      contracts.Database
	builder sq.StatementBuilderType
	tracer  trace.Tracer
	metrics *DataKeyMetrics
}

func ProvideDataKeyStorage(
	db contracts.Database,
	tracer trace.Tracer,
	registerer prometheus.Registerer,
) (contracts.DataKeyStorage, error) {
	builder, _ := database.NewBuilder(db.DriverName())
	store := &encryptionStoreImpl{
		db:      db,
		builder: builder,
		tracer:  tracer,
		metrics: NewDataKeyMetrics(registerer),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*contracts.SecretDataKey, error) {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.GetDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("uid", uid),
	))

	defer func() {
		span.End()
		ss.metrics.GetDataKeyDuration.Observe(float64(time.Since(start)))
	}()

	query, args, err := ss.builder.
		Select(dataKeyColumns...).
		From(tableDataKey).
		Where(sq.Eq{"namespace": namespace, "uid": uid}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building select: %w", err)
	}

	res, err := ss.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("getting data key row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrDataKeyNotFound
	}

	return scanDataKey(res)
}

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*contracts.SecretDataKey, error) {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.GetCurrentDataKey", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("label", label),
	))
	defer func() {
		span.End()
		ss.metrics.GetCurrentDataKeyDuration.Observe(float64(time.Since(start)))
	}()

	query, args, err := ss.builder.
		Select(dataKeyColumns...).
		From(tableDataKey).
		Where(sq.Eq{"namespace": namespace, "label": label, "active": true}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building select: %w", err)
	}

	res, err := ss.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("getting current data key row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrDataKeyNotFound
	}

	return scanDataKey(res)
}

func (ss *encryptionStoreImpl) ListDataKeys(ctx context.Context, namespace string) ([]*contracts.SecretDataKey, error) {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.ListDataKeys", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer func() {
		span.End()
		ss.metrics.ListDataKeysDuration.Observe(float64(time.Since(start)))
	}()

	query, args, err := ss.builder.
		Select(dataKeyColumns...).
		From(tableDataKey).
		Where(sq.Eq{"namespace": namespace}).
		ToSql()
	if err != nil {
		return nil, fmt.Errorf("building select: %w", err)
	}

	rows, err := ss.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("listing data keys: %w", err)
	}
	defer func() { _ = rows.Close() }()

	dataKeys := make([]*contracts.SecretDataKey, 0)
	for rows.Next() {
		dk, err := scanDataKey(rows)
		if err != nil {
			return nil, err
		}
		dataKeys = append(dataKeys, dk)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return dataKeys, nil
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *contracts.SecretDataKey) error {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.CreateDataKey", trace.WithAttributes(
		attribute.String("uid", dataKey.UID),
		attribute.String("namespace", dataKey.Namespace),
		attribute.Bool("active", dataKey.Active),
	))
	defer func() {
		span.End()
		ss.metrics.CreateDataKeyDuration.Observe(float64(time.Since(start)))
	}()

	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	query, args, err := ss.builder.
		Insert(tableDataKey).
		Columns(dataKeyColumns...).
		Values(
			dataKey.UID,
			dataKey.Namespace,
			dataKey.Label,
			dataKey.Provider,
			dataKey.EncryptedData,
			dataKey.Active,
			dataKey.Created,
			dataKey.Updated,
		).
		ToSql()
	if err != nil {
		return fmt.Errorf("building insert: %w", err)
	}

	result, err := ss.db.ExecContext(ctx, query, args...)
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
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.DisableDataKeys", trace.WithAttributes(
		attribute.String("namespace", namespace),
	))
	defer func() {
		span.End()
		ss.metrics.DisableDataKeysDuration.Observe(float64(time.Since(start)))
	}()

	query, args, err := ss.builder.
		Update(tableDataKey).
		Set("active", false).
		Set("updated", time.Now()).
		Where(sq.Eq{"namespace": namespace, "active": true}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building update: %w", err)
	}

	result, err := ss.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("updating data key row: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		logging.FromContext(ctx).Info("Disable all data keys: no keys were disabled for namespace", "namespace", namespace)
	}

	return nil
}

func (ss *encryptionStoreImpl) DeleteDataKey(ctx context.Context, namespace, uid string) error {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "DataKeyStorage.DeleteDataKey", trace.WithAttributes(
		attribute.String("uid", uid),
		attribute.String("namespace", namespace),
	))
	defer func() {
		span.End()
		ss.metrics.DeleteDataKeyDuration.Observe(float64(time.Since(start)))
	}()

	if len(uid) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	query, args, err := ss.builder.
		Delete(tableDataKey).
		Where(sq.Eq{"namespace": namespace, "uid": uid}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building delete: %w", err)
	}

	result, err := ss.db.ExecContext(ctx, query, args...)
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

type globalEncryptionStoreImpl struct {
	db      contracts.Database
	builder sq.StatementBuilderType
	tracer  trace.Tracer
	metrics *GlobalDataKeyMetrics
}

func ProvideGlobalDataKeyStorage(
	db contracts.Database,
	tracer trace.Tracer,
	registerer prometheus.Registerer,
) (contracts.GlobalDataKeyStorage, error) {
	builder, _ := database.NewBuilder(db.DriverName())
	store := &globalEncryptionStoreImpl{
		db:      db,
		builder: builder,
		tracer:  tracer,
		metrics: NewGlobalDataKeyMetrics(registerer),
	}

	return store, nil
}

func (ss *globalEncryptionStoreImpl) DisableAllDataKeys(ctx context.Context) error {
	start := time.Now()
	ctx, span := ss.tracer.Start(ctx, "GlobalDataKeyStorage.DisableAllDataKeys")
	defer func() {
		span.End()
		ss.metrics.DisableAllDataKeysDuration.Observe(float64(time.Since(start)))
	}()

	query, args, err := ss.builder.
		Update(tableDataKey).
		Set("active", false).
		Set("updated", time.Now()).
		Where(sq.Eq{"active": true}).
		ToSql()
	if err != nil {
		return fmt.Errorf("building update: %w", err)
	}

	result, err := ss.db.ExecContext(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("updating data keys: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		logging.FromContext(ctx).Info("Disable all data keys: no keys were disabled")
	}

	return nil
}

// scanDataKey reads a single row with the column order in dataKeyColumns and
// returns a populated *contracts.SecretDataKey.
func scanDataKey(rows contracts.Rows) (*contracts.SecretDataKey, error) {
	var dk SecretDataKey
	if err := rows.Scan(
		&dk.UID,
		&dk.Namespace,
		&dk.Label,
		&dk.Provider,
		&dk.EncryptedData,
		&dk.Active,
		&dk.Created,
		&dk.Updated,
	); err != nil {
		return nil, fmt.Errorf("failed to scan data key row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}
	return &contracts.SecretDataKey{
		UID:           dk.UID,
		Namespace:     dk.Namespace,
		Label:         dk.Label,
		Provider:      dk.Provider,
		EncryptedData: dk.EncryptedData,
		Active:        dk.Active,
		Created:       dk.Created,
		Updated:       dk.Updated,
	}, nil
}
