package secret

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	ErrDataKeyNotFound = errors.New("data key not found")
)

// DataKeyStorage is the interface for wiring and dependency injection.
type DataKeyStorage interface {
	CreateDataKey(ctx context.Context, dataKey *EncryptionDataKey) error
	GetDataKey(ctx context.Context, namespace, uid string) (*EncryptionDataKey, error)
	GetCurrentDataKey(ctx context.Context, namespace, label string) (*EncryptionDataKey, error)
	GetAllDataKeys(ctx context.Context, namespace string) ([]*EncryptionDataKey, error)
	DisableDataKeys(ctx context.Context, namespace string) error
	DeleteDataKey(ctx context.Context, namespace, uid string) error

	ReEncryptDataKeys(ctx context.Context, namespace string, providers map[encryption.ProviderID]encryption.Provider, currProvider encryption.ProviderID) error
}

// encryptionStoreImpl is the actual implementation of the data key storage.
type encryptionStoreImpl struct {
	db  db.DB
	log log.Logger
}

func ProvideDataKeyStorageStorage(db db.DB, cfg *setting.Cfg, features featuremgmt.FeatureToggles) (DataKeyStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &encryptionStoreImpl{}, nil
	}

	if err := migrateSecretSQL(db.GetEngine(), cfg); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	store := &encryptionStoreImpl{
		db:  db,
		log: log.New("encryption.store"),
	}

	return store, nil
}

func (ss *encryptionStoreImpl) GetDataKey(ctx context.Context, namespace, uid string) (*EncryptionDataKey, error) {
	dataKey := &EncryptionDataKey{
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

func (ss *encryptionStoreImpl) GetCurrentDataKey(ctx context.Context, namespace, label string) (*EncryptionDataKey, error) {
	dataKey := &EncryptionDataKey{
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

func (ss *encryptionStoreImpl) GetAllDataKeys(ctx context.Context, namespace string) ([]*EncryptionDataKey, error) {
	result := make([]*EncryptionDataKey, 0)
	cond := &EncryptionDataKey{
		Namespace: namespace,
	}

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&result, cond)
	})

	return result, err
}

func (ss *encryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *EncryptionDataKey) error {
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
	cond := &EncryptionDataKey{
		Namespace: namespace,
		Active:    true,
	}

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.UseBool("active").Update(&EncryptionDataKey{Active: false}, cond)
		return err
	})
}

func (ss *encryptionStoreImpl) DeleteDataKey(ctx context.Context, uid, namespace string) error {
	if len(uid) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	cond := &EncryptionDataKey{
		Namespace: namespace,
		UID:       uid,
	}

	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Delete(cond)

		return err
	})
}

func (ss *encryptionStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	namespace string,
	providers map[encryption.ProviderID]encryption.Provider,
	currProvider encryption.ProviderID,
) error {
	keys := make([]*EncryptionDataKey, 0)
	cond := &EncryptionDataKey{
		Namespace: namespace,
	}
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Find(&keys, cond)
	}); err != nil {
		return err
	}

	for _, k := range keys {
		err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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
			k.Provider = currProvider
			k.Label = encryption.KeyLabel(k.Scope, currProvider)
			k.Updated = time.Now()
			k.EncryptedData, err = providers[currProvider].Encrypt(ctx, decrypted)
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

			if _, err := sess.Update(k); err != nil {
				ss.log.Warn(
					"Error while re-encrypting data encryption key",
					"id", k.UID,
					"label", k.Label,
					"provider", k.Provider,
					"err", err,
				)
				return nil
			}

			return nil
		})

		if err != nil {
			return err
		}
	}

	return nil
}
