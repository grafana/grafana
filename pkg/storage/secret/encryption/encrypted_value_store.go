package encryption

import (
	"context"
	"errors"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
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

func (s *encryptedValStorage) Create(ctx context.Context, namespace, name string, version int64, encryptedData []byte) (ev *contracts.EncryptedValue, err error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Create", trace.WithAttributes(
		attribute.String("namespace", namespace),
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
		Namespace:     namespace,
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData,
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
		Namespace:     encryptedValue.Namespace,
		Name:          encryptedValue.Name,
		Version:       encryptedValue.Version,
		EncryptedData: encryptedValue.EncryptedData,
		Created:       encryptedValue.Created,
		Updated:       encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Update(ctx context.Context, namespace, name string, version int64, encryptedData []byte) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Update", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := updateEncryptedValue{
		SQLTemplate:   sqltemplate.New(s.dialect),
		Namespace:     namespace,
		Name:          name,
		Version:       version,
		EncryptedData: encryptedData,
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

func (s *encryptedValStorage) Get(ctx context.Context, namespace, name string, version int64) (*contracts.EncryptedValue, error) {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Get", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := &readEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
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
	err = rows.Scan(&encryptedValue.Namespace, &encryptedValue.Name, &encryptedValue.Version, &encryptedValue.EncryptedData, &encryptedValue.Created, &encryptedValue.Updated)
	if err != nil {
		return nil, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.EncryptedValue{
		Namespace:     encryptedValue.Namespace,
		Name:          encryptedValue.Name,
		Version:       encryptedValue.Version,
		EncryptedData: encryptedValue.EncryptedData,
		Created:       encryptedValue.Created,
		Updated:       encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Delete(ctx context.Context, namespace, name string, version int64) error {
	ctx, span := s.tracer.Start(ctx, "EncryptedValueStorage.Delete", trace.WithAttributes(
		attribute.String("namespace", namespace),
		attribute.String("name", name),
		attribute.Int64("version", version),
	))
	defer span.End()

	req := deleteEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
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
