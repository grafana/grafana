package encryption

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

var (
	ErrDataKeyNotFound = errors.New("data key not found")
)

// DataKeyStorage is the interface for wiring and dependency injection.
type DataKeyStorage interface {
	CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error
	GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error)
	GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error)
	GetAllDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error)
	DisableDataKeys(ctx context.Context, namespace string) error
	DeleteDataKey(ctx context.Context, namespace, uid string) error
	ReEncryptDataKeys(ctx context.Context, namespace string, providers encryption.ProviderMap, currProvider encryption.ProviderID) error
}

// encryptionStoreImpl is the actual implementation of the data key storage.
type encryptionStoreImpl struct {
	db      contracts.Database
	dialect sqltemplate.Dialect
	log     log.Logger
}

func ProvideDataKeyStorage(oldDb db.DB, db contracts.Database, features featuremgmt.FeatureToggles) (DataKeyStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptionStoreImpl{}, nil
	}

	if err := migrator.MigrateSecretSQL(oldDb.GetEngine(), nil); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	store := &encryptionStoreImpl{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		log:     log.New("encryption.store"),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error) {
	req := &readDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		UID:         uid,
	}

	query, err := sqltemplate.Execute(sqlDataKeyRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyRead.Name(), err)
	}

	var dataKey SecretDataKey
	rows, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, ErrDataKeyNotFound
	}

	err = rows.Scan(
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
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return &dataKey, nil
}

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error) {
	req := &readCurrentDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		Label:       label,
	}

	query, err := sqltemplate.Execute(sqlDataKeyReadCurrent, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyReadCurrent.Name(), err)
	}

	var dataKey SecretDataKey

	rows, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	if !rows.Next() {
		return nil, ErrDataKeyNotFound
	}

	err = rows.Scan(
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
		return nil, fmt.Errorf("failed getting current data key: %w", err)
	}

	return &dataKey, nil
}

func (ss *encryptionStoreImpl) GetAllDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error) {
	req := &listDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
	}

	query, err := sqltemplate.Execute(sqlDataKeyList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlDataKeyList.Name(), err)
	}

	var dataKeys []*SecretDataKey
	rows, err := ss.db.QueryContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var dataKey SecretDataKey
		err := rows.Scan(
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
			return nil, fmt.Errorf("failed scanning data key row: %w", err)
		}
		dataKeys = append(dataKeys, &dataKey)
	}

	if err != nil {
		return nil, fmt.Errorf("failed getting all data keys: %w", err)
	}

	return dataKeys, nil
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	req := &createDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Row:         dataKey,
	}

	query, err := sqltemplate.Execute(sqlDataKeyCreate, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyCreate.Name(), err)
	}

	var result sql.Result
	result, err = ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed creating data key: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed getting rows affected: %w", err)
	}

	if rowsAffected != 1 {
		return fmt.Errorf("expected 1 row affected, got %d", rowsAffected)
	}

	return nil
}

func (ss *encryptionStoreImpl) DisableDataKeys(ctx context.Context, namespace string) error {
	req := &disableDataKey{
		SQLTemplate: sqltemplate.New(ss.dialect),
		Namespace:   namespace,
		Updated:     time.Now(),
	}

	query, err := sqltemplate.Execute(sqlDataKeyDisable, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyDisable.Name(), err)
	}

	var result sql.Result
	result, err = ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed disabling data keys: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no active data keys found to disable")
	}

	return nil
}

func (ss *encryptionStoreImpl) DeleteDataKey(ctx context.Context, namespace, uid string) error {
	if len(uid) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	req := &deleteDataKey{
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
		return fmt.Errorf("failed deleting data key: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrDataKeyNotFound
	}

	return nil
}

func (ss *encryptionStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	namespace string,
	providers encryption.ProviderMap,
	currProvider encryption.ProviderID,
) error {
	keys, err := ss.GetAllDataKeys(ctx, namespace)
	if err != nil {
		return err
	}

	selectStatements := make([]string, len(keys))
	for i, k := range keys {
		provider, ok := providers[k.Provider]
		if !ok {
			ss.log.Warn(
				"Could not find provider to re-encrypt data encryption key",
				"id", k.UID,
				"label", k.Label,
				"provider", k.Provider,
			)
			continue
		}

		decrypted, err := provider.Decrypt(ctx, k.EncryptedData)
		if err != nil {
			ss.log.Warn(
				"Error while decrypting data encryption key to re-encrypt it",
				"id", k.UID,
				"label", k.Label,
				"provider", k.Provider,
				"err", err,
			)
			continue
		}

		encryptedData, err := providers[currProvider].Encrypt(ctx, decrypted)
		if err != nil {
			ss.log.Warn(
				"Error while re-encrypting data encryption key",
				"id", k.UID,
				"label", k.Label,
				"provider", k.Provider,
				"err", err,
			)
			continue
		}

		var statement string
		if i == 0 {
			statement = fmt.Sprintf("SELECT '%s' AS uid, '%s' AS label, x'%s' AS encrypted_data",
				k.UID,
				encryption.KeyLabel(currProvider),
				encryptedData,
			)
		} else {
			statement = fmt.Sprintf("SELECT '%s', '%s', x'%s'",
				k.UID,
				encryption.KeyLabel(currProvider),
				encryptedData,
			)
		}

		selectStatements[i] = statement
	}

	req := &reencryptDataKey{
		SQLTemplate:      sqltemplate.New(ss.dialect),
		SelectStatements: strings.Join(selectStatements, " UNION ALL "),
		Provider:         currProvider,
		Updated:          time.Now(),
	}

	query, err := sqltemplate.Execute(sqlDataKeyReencrypt, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlDataKeyReencrypt.Name(), err)
	}

	result, err := ss.db.ExecContext(ctx, query, req.GetArgs()...)
	if err != nil {
		return fmt.Errorf("failed re-encrypting data keys: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed getting rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("no data keys were re-encrypted")
	}

	return nil
}
