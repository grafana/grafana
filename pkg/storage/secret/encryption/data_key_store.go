package encryption

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
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
	db  db.DB
	log log.Logger
}

func ProvideDataKeyStorage(db db.DB, features featuremgmt.FeatureToggles) (DataKeyStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptionStoreImpl{}, nil
	}

	store := &encryptionStoreImpl{
		db:  db,
		log: log.New("encryption.store"),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*SecretDataKey, error) {
	dataKey := &SecretDataKey{
		UID:       uid,
		Namespace: namespace,
	}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Get(dataKey)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	if !exists {
		return nil, ErrDataKeyNotFound
	}

	return dataKey, nil
}

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*SecretDataKey, error) {
	dataKey := &SecretDataKey{
		Label:     label,
		Namespace: namespace,
		Active:    true,
	}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Get(dataKey)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("failed getting current data key: %w", err)
	}

	if !exists {
		return nil, ErrDataKeyNotFound
	}

	return dataKey, nil
}

func (ss *encryptionStoreImpl) GetAllDataKeys(ctx context.Context, namespace string) ([]*SecretDataKey, error) {
	result := make([]*SecretDataKey, 0)
	cond := &SecretDataKey{
		Namespace: namespace,
	}

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&result, cond)
	})

	return result, err
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *SecretDataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Insert(dataKey)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ss *encryptionStoreImpl) DisableDataKeys(ctx context.Context, namespace string) error {
	cond := &SecretDataKey{
		Namespace: namespace,
		Active:    true,
	}

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.UseBool("active").Update(&SecretDataKey{Active: false}, cond)
		return err
	})
}

func (ss *encryptionStoreImpl) DeleteDataKey(ctx context.Context, namespace, uid string) error {
	if len(uid) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	cond := &SecretDataKey{
		Namespace: namespace,
		UID:       uid,
	}

	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(cond)

		return err
	})
}

// TODO this doesn't past tests yet, do not use
func (ss *encryptionStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	namespace string,
	providers encryption.ProviderMap,
	currProvider encryption.ProviderID,
) error {
	keys := make([]*SecretDataKey, 0)
	cond := &SecretDataKey{
		Namespace: namespace,
	}
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&keys, cond)
	}); err != nil {
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
			return nil
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
			return nil
		}

		// Updating current data key by re-encrypting it with current provider.
		// Accessing the current provider within providers map should be safe.
		encryptedData, err := providers[currProvider].Encrypt(ctx, decrypted)
		if err != nil {
			ss.log.Warn(
				"Error while re-encrypting data encryption key",
				"id", k.UID,
				"label", k.Label,
				"provider", k.Provider,
				"err", err,
			)
			return nil
		}

		var statement string
		// Only need to name the columns once, omit them after that for efficiency's sake
		if i == 0 {
			statement = fmt.Sprintf("SELECT '%s' AS %s, '%s' AS %s, '%s' AS %s",
				k.UID, "uid",
				encryption.KeyLabel(currProvider), "label",
				encryptedData, "encrypted_data",
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

	// TODO this looks different depending on which database is being used, need to handle all cases
	rawSql := fmt.Sprintf(`
		WITH updates AS ( 
			%s 
		) 
		UPDATE %s 
		JOIN updates ON %s.uid = updates.uid 
		SET %s.label = updates.label, 
			%s.encrypted_data = updates.encrypted_data, 
			%s.provider = '%s', 
			%s.updated = '%s'
	`, strings.Join(selectStatements, " UNION ALL "), migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, migrator.TableNameDataKey, currProvider, migrator.TableNameDataKey, time.Now().UTC().Format("2006-01-02 15:04:05"))

	fmt.Println(rawSql)
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Exec(rawSql)
		return err
	}); err != nil {
		return err
	}

	return nil
}
