package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/kmsproviders"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

type SecretsStoreImpl struct {
	sql   legacysql.LegacyDatabaseProvider
	log   log.Logger
	table string
}

func ProvideSecretsStore(sql legacysql.LegacyDatabaseProvider) *SecretsStoreImpl {
	store := &SecretsStoreImpl{
		sql:   sql,
		log:   log.New("secrets.store"),
		table: "data_keys",
	}

	return store
}

func NewSecretsStoreForTable(sql legacysql.LegacyDatabaseProvider, table string) *SecretsStoreImpl {
	store := ProvideSecretsStore(sql)
	store.table = table
	return store
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, id string) (*secrets.DataKey, error) {
	dataKey := &secrets.DataKey{}
	var exists bool

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(dbHelper.Table(ss.table)).
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

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(dbHelper.Table(ss.table)).
			Where("label = ? AND active = ?", label, dbHelper.DB.GetDialect().BooleanValue(true)).
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
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return nil, fmt.Errorf("get legacy DB: %w", err)
	}

	err = dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table(dbHelper.Table(ss.table)).Find(&result)
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

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dbHelper.Table(ss.table)).Insert(dataKey)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ss *SecretsStoreImpl) DisableDataKeys(ctx context.Context) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dbHelper.Table(ss.table)).
			Where("active = ?", dbHelper.DB.GetDialect().BooleanValue(true)).
			UseBool("active").Update(&secrets.DataKey{Active: false})
		return err
	})
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, id string) error {
	if len(id) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	return dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(dbHelper.Table(ss.table)).Delete(&secrets.DataKey{Id: id})

		return err
	})
}

func (ss *SecretsStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	providers map[secrets.ProviderID]secrets.Provider, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	currProvider secrets.ProviderID,
) error {
	dbHelper, err := ss.sql(ctx)
	if err != nil {
		return fmt.Errorf("get legacy DB: %w", err)
	}

	keys := make([]*secrets.DataKey, 0)
	if err := dbHelper.DB.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(dbHelper.Table(ss.table)).Find(&keys)
	}); err != nil {
		return err
	}

	for _, k := range keys {
		err := dbHelper.DB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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

			if _, err := sess.Table(dbHelper.Table(ss.table)).Where("name = ?", k.Id).Update(k); err != nil {
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
