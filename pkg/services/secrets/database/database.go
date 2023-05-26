package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
)

const dataKeysTable = "data_keys"

type SecretsStoreImpl struct {
	db  db.DB
	log log.Logger
}

func ProvideSecretsStore(db db.DB) *SecretsStoreImpl {
	store := &SecretsStoreImpl{
		db:  db,
		log: log.New("secrets.store"),
	}

	return store
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, id string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("name = ?", id).
			Get(dataKey)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetCurrentDataKey(ctx context.Context, label string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("label = ? AND active = ?", label, ss.db.GetDialect().BooleanStr(true)).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed getting current data key: %w", err)
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetAllDataKeys(ctx context.Context) ([]*secrets.DataKey, error) {
	result := make([]*secrets.DataKey, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table(dataKeysTable).Find(&result)
		return err
	})
	return result, err
}

func (ss *SecretsStoreImpl) CreateDataKey(ctx context.Context, dataKey *secrets.DataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dataKeysTable).Insert(dataKey)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ss *SecretsStoreImpl) DisableDataKeys(ctx context.Context) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dataKeysTable).
			Where("active = ?", ss.db.GetDialect().BooleanStr(true)).
			UseBool("active").Update(&secrets.DataKey{Active: false})
		return err
	})
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, id string) error {
	if len(id) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dataKeysTable).Delete(&secrets.DataKey{Id: id})

		return err
	})
}

func (ss *SecretsStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	providers map[secrets.ProviderID]secrets.Provider,
	currProvider secrets.ProviderID,
) error {
	keys := make([]*secrets.DataKey, 0)
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(dataKeysTable).Find(&keys)
	}); err != nil {
		return err
	}

	for _, k := range keys {
		err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			provider, ok := providers[kmsproviders.NormalizeProviderID(k.Provider)]
			if !ok {
				ss.log.Warn(
					"Could not find provider to re-encrypt data encryption key",
					"id", k.Id,
					"label", k.Label,
					"provider", k.Provider,
				)
				return nil
			}

			decrypted, err := provider.Decrypt(ctx, k.EncryptedData)
			if err != nil {
				ss.log.Warn(
					"Error while decrypting data encryption key to re-encrypt it",
					"id", k.Id,
					"label", k.Label,
					"provider", k.Provider,
					"err", err,
				)
				return nil
			}

			// Updating current data key by re-encrypting it with current provider.
			// Accessing the current provider within providers map should be safe.
			k.Provider = currProvider
			k.Label = secrets.KeyLabel(k.Scope, currProvider)
			k.Updated = time.Now()
			k.EncryptedData, err = providers[currProvider].Encrypt(ctx, decrypted)
			if err != nil {
				ss.log.Warn(
					"Error while re-encrypting data encryption key",
					"id", k.Id,
					"label", k.Label,
					"provider", k.Provider,
					"err", err,
				)
				return nil
			}

			if _, err := sess.Table(dataKeysTable).Where("name = ?", k.Id).Update(k); err != nil {
				ss.log.Warn(
					"Error while re-encrypting data encryption key",
					"id", k.Id,
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
