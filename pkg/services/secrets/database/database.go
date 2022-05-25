package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"xorm.io/xorm"
)

const dataKeysTable = "data_keys"

type SecretsStoreImpl struct {
	sqlStore *sqlstore.SQLStore
	log      log.Logger
}

func ProvideSecretsStore(sqlStore *sqlstore.SQLStore) *SecretsStoreImpl {
	return &SecretsStoreImpl{
		sqlStore: sqlStore,
		log:      log.New("secrets.store"),
	}
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, id string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	err := ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("id = ?", id).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetCurrentDataKey(ctx context.Context, name string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	err := ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		var err error
		exists, err = sess.Table(dataKeysTable).
			Where("name = ? AND active = ?", name, ss.sqlStore.Dialect.BooleanStr(true)).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetAllDataKeys(ctx context.Context) ([]*secrets.DataKey, error) {
	result := make([]*secrets.DataKey, 0)
	err := ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		err := sess.Table(dataKeysTable).Find(&result)
		return err
	})
	return result, err
}

func (ss *SecretsStoreImpl) CreateDataKey(ctx context.Context, dataKey *secrets.DataKey) error {
	return ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		return ss.CreateDataKeyWithDBSession(ctx, dataKey, sess.Session)
	})
}

func (ss *SecretsStoreImpl) CreateDataKeyWithDBSession(_ context.Context, dataKey *secrets.DataKey, sess *xorm.Session) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	_, err := sess.Table(dataKeysTable).Insert(dataKey)
	return err
}

func (ss *SecretsStoreImpl) DisableDataKeys(ctx context.Context) error {
	return ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
		_, err := sess.Table(dataKeysTable).
			Where("active = ?", ss.sqlStore.Dialect.BooleanStr(true)).
			UseBool("active").Update(&secrets.DataKey{Active: false})
		return err
	})
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, id string) error {
	if len(id) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	return ss.sqlStore.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
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
	if err := ss.sqlStore.NewSession(ctx).Table(dataKeysTable).Find(&keys); err != nil {
		return err
	}

	for _, k := range keys {
		err := ss.sqlStore.WithTransactionalDbSession(ctx, func(sess *sqlstore.DBSession) error {
			provider, ok := providers[kmsproviders.NormalizeProviderID(k.Provider)]
			if !ok {
				ss.log.Warn(
					"Could not find provider to re-encrypt data encryption key",
					"id", k.Id,
					"name", k.Name,
					"provider", k.Provider,
				)
				return nil
			}

			decrypted, err := provider.Decrypt(ctx, k.EncryptedData)
			if err != nil {
				ss.log.Warn(
					"Error while decrypting data encryption key to re-encrypt it",
					"id", k.Id,
					"name", k.Name,
					"provider", k.Provider,
					"err", err,
				)
				return nil
			}

			// Updating current data key by re-encrypting it with current provider.
			// Accessing the current provider within providers map should be safe.
			k.Provider = currProvider
			k.Name = secrets.KeyName(k.Scope, currProvider)
			k.Updated = time.Now()
			k.EncryptedData, err = providers[currProvider].Encrypt(ctx, decrypted)
			if err != nil {
				ss.log.Warn(
					"Error while re-encrypting data encryption key",
					"id", k.Id,
					"name", k.Name,
					"provider", k.Provider,
					"err", err,
				)
				return nil
			}

			if _, err := sess.Table(dataKeysTable).Where("id = ?", k.Id).Update(k); err != nil {
				ss.log.Warn(
					"Error while re-encrypting data encryption key",
					"id", k.Id,
					"name", k.Name,
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
