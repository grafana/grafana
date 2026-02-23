package encryption

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	ErrEncryptedValueNotFound         = errors.New("encrypted value not found")
	ErrEncryptedValueAlreadyExists    = errors.New("encrypted value alredy exists")
	ErrUnexpectedNumberOfRowsAffected = errors.New("unexpected number of rows modified by query")
)

func ProvideEncryptedValueStorage(
	db contracts.Database,
	tracer trace.Tracer,
) (contracts.EncryptedValueStorage, error) {
	return &encryptedValStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
	}, nil
}

type encryptedValStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
}

func (s *encryptedValStorage) Create(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData contracts.EncryptedPayload) (ev *contracts.EncryptedValue, err error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Create", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
	))
	defer span.End()

	defer func() {
		if ev != nil {
			span.SetAttributes(
				attribute.String("namespace", ev.Namespace),
				attribute.String("name", ev.Name),
				attribute.Int64("version", ev.Version),
			)
		}
	}()

	createdTime := time.Now().Unix()

	encryptedValue := &EncryptedValue{
		Namespace:     namespace.String(),
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData.EncryptedData,
		DataKeyID:     encryptedData.DataKeyID,
		Created:       createdTime,
		Updated:       createdTime,
	}

	req := createEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         encryptedValue,
	}
	query, err := sqltemplate.Execute(sqlEncryptedValueCreate, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", sqlEncryptedValueCreate.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		if sql.IsRowAlreadyExistsError(err) {
			return nil, ErrEncryptedValueAlreadyExists
		}
		return nil, fmt.Errorf("inserting row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return nil, fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected != 1 {
		return nil, fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	return &contracts.EncryptedValue{
		Namespace: encryptedValue.Namespace,
		Name:      encryptedValue.Name,
		Version:   encryptedValue.Version,
		EncryptedPayload: contracts.EncryptedPayload{
			DataKeyID:     encryptedValue.DataKeyID,
			EncryptedData: encryptedValue.EncryptedData,
		},
		Created: encryptedValue.Created,
		Updated: encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Update(ctx context.Context, namespace xkube.Namespace, name string, version int64, encryptedData contracts.EncryptedPayload) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Update", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := updateEncryptedValue{
		SQLTemplate:   sqltemplate.New(s.dialect),
		Namespace:     namespace.String(),
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData.EncryptedData,
		DataKeyID:     encryptedData.DataKeyID,
		Updated:       time.Now().Unix(),
	}

	query, err := sqltemplate.Execute(sqlEncryptedValueUpdate, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlEncryptedValueUpdate.Name(), err)
	}

	res, err := s.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("updating row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d on %s: %w", rowsAffected, namespace, ErrUnexpectedNumberOfRowsAffected)
	}

	return nil
}

func (s *encryptedValStorage) Get(ctx context.Context, namespace xkube.Namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Get", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := &readEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Version:     version,
	}
	query, err := sqltemplate.Execute(sqlEncryptedValueRead, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", sqlEncryptedValueRead.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, ErrEncryptedValueNotFound
	}

	var encryptedValue EncryptedValue
	err = rows.Scan(&encryptedValue.Namespace, &encryptedValue.Name, &encryptedValue.Version, &encryptedValue.EncryptedData, &encryptedValue.DataKeyID, &encryptedValue.Created, &encryptedValue.Updated)
	if err != nil {
		return nil, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.EncryptedValue{
		Namespace: encryptedValue.Namespace,
		Name:      encryptedValue.Name,
		Version:   encryptedValue.Version,
		EncryptedPayload: contracts.EncryptedPayload{
			DataKeyID:     encryptedValue.DataKeyID,
			EncryptedData: encryptedValue.EncryptedData,
		},
		Created: encryptedValue.Created,
		Updated: encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace.String()),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := deleteEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
		Version:     version,
	}
	query, err := sqltemplate.Execute(sqlEncryptedValueDelete, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlEncryptedValueDelete.Name(), err)
	}

	if _, err = s.db.ExecContext(ctx, query, req.GetArgs()...); err != nil {
		return fmt.Errorf("deleting row: %w", err)
	}

	return nil
}

type globalEncryptedValStorage struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	tracer  trace.Tracer
}

func ProvideGlobalEncryptedValueStorage(
	db contracts.Database,
	tracer trace.Tracer,
) (contracts.GlobalEncryptedValueStorage, error) {
	return &globalEncryptedValStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		tracer:  tracer,
	}, nil
}

func (s *globalEncryptedValStorage) ListAll(ctx context.Context, opts contracts.ListOpts, untilTime *int64) ([]*contracts.EncryptedValue, error) {
	attrs := []attribute.KeyValue{
		attribute.Int64("limit", opts.Limit),
		attribute.Int64("offset", opts.Offset),
	}
	if untilTime != nil {
		attrs = append(attrs, attribute.Int64("untilTime", *untilTime))
	}
	ctx, span := s.tracer.Start(ctx, "GlobalEncryptedValueStorage.CountAll", trace.WithAttributes(attrs...))
	defer span.End()

	req := listAllEncryptedValues{
		SQLTemplate: sqltemplate.New(s.dialect),
		Limit:       opts.Limit,
		Offset:      opts.Offset,
	}
	if untilTime != nil {
		req.HasUntilTime = true
		req.UntilTime = *untilTime
	}

	query, err := sqltemplate.Execute(sqlEncryptedValueListAll, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlEncryptedValueListAll.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing encrypted values %q: %w", sqlEncryptedValueListAll.Name(), err)
	}
	defer func() { _ = rows.Close() }()

	encryptedValues := make([]*contracts.EncryptedValue, 0)
	for rows.Next() {
		var row EncryptedValue
		err = rows.Scan(
			&row.Namespace,
			&row.Name,
			&row.Version,
			&row.EncryptedData,
			&row.DataKeyID,
			&row.Created,
			&row.Updated,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading data key row: %w", err)
		}

		encryptedValues = append(encryptedValues, &contracts.EncryptedValue{
			Namespace: row.Namespace,
			Name:      row.Name,
			Version:   row.Version,
			EncryptedPayload: contracts.EncryptedPayload{
				DataKeyID:     row.DataKeyID,
				EncryptedData: row.EncryptedData,
			},
			Created: row.Created,
			Updated: row.Updated,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return encryptedValues, nil
}

func (s *globalEncryptedValStorage) CountAll(ctx context.Context, untilTime *int64) (int64, error) {
	attrs := []attribute.KeyValue{}
	if untilTime != nil {
		attrs = append(attrs, attribute.Int64("untilTime", *untilTime))
	}
	ctx, span := s.tracer.Start(ctx, "GlobalEncryptedValueStorage.CountAll", trace.WithAttributes(attrs...))
	defer span.End()

	req := countAllEncryptedValues{
		SQLTemplate: sqltemplate.New(s.dialect),
	}
	if untilTime != nil {
		req.HasUntilTime = true
		req.UntilTime = *untilTime
	}

	query, err := sqltemplate.Execute(sqlEncryptedValueCountAll, req)
	if err != nil {
		return 0, fmt.Errorf("execute template %q: %w", sqlEncryptedValueCountAll.Name(), err)
	}

	rows, err := s.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return 0, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return 0, fmt.Errorf("no rows returned when counting encrypted values")
	}

	var count int64
	err = rows.Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("read rows error: %w", err)
	}

	return count, nil
}

type encryptedValMigrationExecutor struct {
	db                  contracts.Database
	dialect             sqltemplate.Dialect
	tracer              trace.Tracer
	encryptedValueStore contracts.EncryptedValueStorage
	globalStore         contracts.GlobalEncryptedValueStorage
}

func ProvideEncryptedValueMigrationExecutor(
	db contracts.Database,
	tracer trace.Tracer,
	encryptedValueStore contracts.EncryptedValueStorage,
	globalStore contracts.GlobalEncryptedValueStorage,
) (contracts.EncryptedValueMigrationExecutor, error) {
	return &encryptedValMigrationExecutor{
		db:                  db,
		dialect:             sqltemplate.DialectForDriver(db.DriverName()),
		tracer:              tracer,
		encryptedValueStore: encryptedValueStore,
		globalStore:         globalStore,
	}, nil
}

func (s *encryptedValMigrationExecutor) Execute(ctx context.Context) (int, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueMigrationExecutor.Execute")
	defer span.End()

	// 1. Retrieve all encrypted values
	encryptedValues, err := s.globalStore.ListAll(ctx, contracts.ListOpts{}, nil)
	if err != nil {
		return 0, fmt.Errorf("listing all encrypted values: %w", err)
	}

	// This doesn't need to be done in a single transaction because there's no risk to successful rows if other rows fail
	rowsAffected := 0
	for _, encryptedValue := range encryptedValues {
		// 2. If the value already has the data key id broken out, skip it
		if encryptedValue.DataKeyID != "" {
			continue
		}

		// 3. Split the data key id and the encrypted data out from the encoded payload
		payload := encryptedValue.EncryptedData
		const keyIdDelimiter = '#'
		payload = payload[1:]
		endOfKey := bytes.Index(payload, []byte{keyIdDelimiter})
		if endOfKey == -1 {
			return rowsAffected, fmt.Errorf("could not find valid key id in encrypted payload with namespace %s and name %s and version %d", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version)
		}
		b64Key := payload[:endOfKey]
		encryptedData := payload[endOfKey+1:]
		if len(encryptedData) == 0 {
			return rowsAffected, fmt.Errorf("encrypted data is empty with namespace %s and name %s and version %d", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version)
		}
		keyId := make([]byte, base64.RawStdEncoding.DecodedLen(len(b64Key)))
		_, err := base64.RawStdEncoding.Decode(keyId, b64Key)
		if err != nil {
			return rowsAffected, fmt.Errorf("decoding key id with namespace %s and name %s and version %d: %w", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version, err)
		}

		// 4. Update the encrypted value with the data key id and the encrypted data
		err = s.encryptedValueStore.Update(ctx, xkube.Namespace(encryptedValue.Namespace), encryptedValue.Name, encryptedValue.Version, contracts.EncryptedPayload{
			DataKeyID:     string(keyId),
			EncryptedData: encryptedData,
		})
		if err != nil {
			return rowsAffected, fmt.Errorf("updating encrypted value with namespace %s and name %s and version %d: %w", encryptedValue.Namespace, encryptedValue.Name, encryptedValue.Version, err)
		}
		rowsAffected++
	}

	return rowsAffected, nil
}
