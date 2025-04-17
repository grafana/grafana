package encryption

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	ErrEncryptedValueNotFound = errors.New("encrypted value not found")
)

func ProvideEncryptedValueStorage(db db.DB, features featuremgmt.FeatureToggles) (contracts.EncryptedValueStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptedValStorage{}, nil
	}

	return &encryptedValStorage{
		db:      db,
		dialect: sqltemplate.DialectForDriver(string(db.GetDBType())),
	}, nil
}

type encryptedValStorage struct {
	db      db.DB
	dialect sqltemplate.Dialect
}

func (s *encryptedValStorage) Create(ctx context.Context, namespace string, encryptedData []byte) (*contracts.EncryptedValue, error) {
	createdTime := time.Now().Unix()
	encryptedValue := &EncryptedValue{
		UID:           uuid.New().String(),
		Namespace:     namespace,
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

	if _, err = s.db.GetSqlxSession().Exec(ctx, query, req.GetArgs()...); err != nil {
		return nil, fmt.Errorf("inserting row: %w", err)
	}

	return &contracts.EncryptedValue{
		UID:           encryptedValue.UID,
		Namespace:     encryptedValue.Namespace,
		EncryptedData: encryptedValue.EncryptedData,
		Created:       encryptedValue.Created,
		Updated:       encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Update(ctx context.Context, namespace string, uid string, encryptedData []byte) error {
	req := updateEncryptedValue{
		SQLTemplate:   sqltemplate.New(s.dialect),
		Namespace:     namespace,
		UID:           uid,
		EncryptedData: encryptedData,
		Updated:       time.Now().Unix(),
	}

	query, err := sqltemplate.Execute(sqlEncryptedValueUpdate, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlEncryptedValueUpdate.Name(), err)
	}

	res, err := s.db.GetSqlxSession().Exec(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("updating row: %w", err)
	}

	if rowsAffected, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("getting rows affected: %w", err)
	} else if rowsAffected == 0 {
		return ErrEncryptedValueNotFound
	}

	return nil
}

func (s *encryptedValStorage) Get(ctx context.Context, namespace string, uid string) (*contracts.EncryptedValue, error) {
	req := &readEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
		UID:         uid,
	}
	query, err := sqltemplate.Execute(sqlEncryptedValueRead, req)
	if err != nil {
		return nil, fmt.Errorf("executing template %q: %w", sqlEncryptedValueRead.Name(), err)
	}

	rows, err := s.db.GetSqlxSession().Query(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = rows.Close() }()

	if !rows.Next() {
		return nil, ErrEncryptedValueNotFound
	}

	encryptedValue := &EncryptedValue{}
	err = rows.Scan(&encryptedValue.UID, &encryptedValue.Namespace, &encryptedValue.EncryptedData, &encryptedValue.Created, &encryptedValue.Updated)
	if err != nil {
		return nil, fmt.Errorf("failed to scan encrypted value row: %w", err)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return &contracts.EncryptedValue{
		UID:           encryptedValue.UID,
		Namespace:     encryptedValue.Namespace,
		EncryptedData: encryptedValue.EncryptedData,
		Created:       encryptedValue.Created,
		Updated:       encryptedValue.Updated,
	}, nil
}

func (s *encryptedValStorage) Delete(ctx context.Context, namespace string, uid string) error {
	req := deleteEncryptedValue{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
		UID:         uid,
	}
	query, err := sqltemplate.Execute(sqlEncryptedValueDelete, req)
	if err != nil {
		return fmt.Errorf("executing template %q: %w", sqlEncryptedValueDelete.Name(), err)
	}

	if _, err = s.db.GetSqlxSession().Exec(ctx, query, req.GetArgs()...); err != nil {
		return fmt.Errorf("deleting row: %w", err)
	}

	return nil
}
