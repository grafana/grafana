package encryption

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

func ProvideDataKeyStorage(db contracts.Database, features featuremgmt.FeatureToggles) (DataKeyStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptionStoreImpl{}, nil
	}

	store := &encryptionStoreImpl{
		db:      db,
		dialect: sqltemplate.DialectForDriver(db.DriverName()),
		log:     log.New("encryption.store"),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error) {
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
		return nil, ErrDataKeyNotFound
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

	return &dataKey, nil
}

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error) {
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
		return nil, ErrDataKeyNotFound
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

	return &dataKey, nil
}

func (ss *encryptionStoreImpl) GetAllDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error) {
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

	dataKeys := make([]*SecretDataKey, 0)
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

		dataKeys = append(dataKeys, &row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return dataKeys, nil
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error {
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

// TODO this doesn't past tests yet, do not use
// TODO: migrate to sql template
func (ss *encryptionStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	namespace string,
	providers encryption.ProviderMap,
	currProvider encryption.ProviderID,
) error {
	panic("ReEncryptDataKeys: not implemented")

	// selectStatements := make([]string, len(keys))

	// for i, k := range keys {
	// 	provider, ok := providers[k.Provider]
	// 	if !ok {
	// 		ss.log.Warn(
	// 			"Could not find provider to re-encrypt data encryption key",
	// 			"id", k.UID,
	// 			"label", k.Label,
	// 			"provider", k.Provider,
	// 		)
	// 		return nil
	// 	}

	// 	decrypted, err := provider.Decrypt(ctx, k.EncryptedData)
	// 	if err != nil {
	// 		ss.log.Warn(
	// 			"Error while decrypting data encryption key to re-encrypt it",
	// 			"id", k.UID,
	// 			"label", k.Label,
	// 			"provider", k.Provider,
	// 			"err", err,
	// 		)
	// 		return nil
	// 	}

	// 	// Updating current data key by re-encrypting it with current provider.
	// 	// Accessing the current provider within providers map should be safe.
	// 	encryptedData, err := providers[currProvider].Encrypt(ctx, decrypted)
	// 	if err != nil {
	// 		ss.log.Warn(
	// 			"Error while re-encrypting data encryption key",
	// 			"id", k.UID,
	// 			"label", k.Label,
	// 			"provider", k.Provider,
	// 			"err", err,
	// 		)
	// 		return nil
	// 	}

	// 	var statement string
	// 	// Only need to name the columns once, omit them after that for efficiency's sake
	// 	if i == 0 {
	// 		statement = fmt.Sprintf("SELECT '%s' AS %s, '%s' AS %s, '%s' AS %s",
	// 			k.UID, "uid",
	// 			encryption.KeyLabel(currProvider), "label",
	// 			encryptedData, "encrypted_data",
	// 		)
	// 	} else {
	// 		statement = fmt.Sprintf("SELECT '%s', '%s', x'%s'",
	// 			k.UID,
	// 			encryption.KeyLabel(currProvider),
	// 			encryptedData,
	// 		)
	// 	}

	// 	selectStatements[i] = statement
	// }

	// // TODO this looks different depending on which database is being used, need to handle all cases
	// rawSql := fmt.Sprintf(`
	// 	WITH updates AS (
	// 		%s
	// 	)
	// 	UPDATE %s
	// 	JOIN updates ON %s.uid = updates.uid
	// 	SET %s.label = updates.label,
	// 		%s.encrypted_data = updates.encrypted_data,
	// 		%s.provider = '%s',
	// 		%s.updated = '%s'
	// `, strings.Join(selectStatements, " UNION ALL "), migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, currProvider, migrator.TableNameDataKey, time.Now().UTC().Format("2006-01-02 15:04:05"))

	// fmt.Println(rawSql)
	// if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
	// 	_, err := sess.Exec(rawSql)
	// 	return err
	// }); err != nil {
	// 	return err
	// }

	// return nil
}
