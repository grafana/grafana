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
	dbProvider legacysql.LegacyDatabaseProvider
	log        log.Logger
	table      string
}

func ProvideSecretsStore(dbProvider legacysql.LegacyDatabaseProvider) *SecretsStoreImpl {
	store := &SecretsStoreImpl{
		dbProvider: dbProvider,
		log:        log.New("secrets.store"),
		table:      "data_keys",
	}

	return store
}

func NewSecretsStoreForTable(dbProvider legacysql.LegacyDatabaseProvider, table string) *SecretsStoreImpl {
	store := ProvideSecretsStore(dbProvider)
	store.table = table
	return store
}

// dbAndTable resolves the database and the data keys table for the tenant in ctx.
// Callers must use the returned database: a session already placed on ctx (e.g. by a caller's
// transaction) is reused without checking which engine created it.
func (ss *SecretsStoreImpl) dbAndTable(ctx context.Context) (db.DB, string, error) {
	dbHelper, err := ss.dbProvider(ctx)
	if err != nil {
		return nil, "", err
	}
	return dbHelper.DB, dbHelper.Table(ss.table), nil
}

func (ss *SecretsStoreImpl) GetDataKey(ctx context.Context, id string) (*secrets.DataKey, error) {
	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return nil, err
	}

	dataKey := &secrets.DataKey{}
	var exists bool

	err = sqlDB.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(table).
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
	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return nil, err
	}

	dataKey := &secrets.DataKey{}
	var exists bool

	err = sqlDB.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(table).
			Where("label = ? AND active = ?", label, sqlDB.GetDialect().BooleanValue(true)).
			Get(dataKey)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("failed getting current data key: %w", err)
	}

	if !exists {
		return nil, secrets.ErrDataKeyNotFound
	}

	return dataKey, nil
}

func (ss *SecretsStoreImpl) GetAllDataKeys(ctx context.Context) ([]*secrets.DataKey, error) {
	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]*secrets.DataKey, 0)
	err = sqlDB.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(table).Find(&result)
	})
	return result, err
}

func (ss *SecretsStoreImpl) CreateDataKey(ctx context.Context, dataKey *secrets.DataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return err
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	return sqlDB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(table).Insert(dataKey)
		return err
	})
}

func (ss *SecretsStoreImpl) DisableDataKeys(ctx context.Context) error {
	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return err
	}

	return sqlDB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(table).
			Where("active = ?", sqlDB.GetDialect().BooleanValue(true)).
			UseBool("active").Update(&secrets.DataKey{Active: false})
		return err
	})
}

func (ss *SecretsStoreImpl) DeleteDataKey(ctx context.Context, id string) error {
	if len(id) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return err
	}

	return sqlDB.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(table).Delete(&secrets.DataKey{Id: id})
		return err
	})
}

func (ss *SecretsStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	providers map[secrets.ProviderID]secrets.Provider, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	currProvider secrets.ProviderID,
) error {
	sqlDB, table, err := ss.dbAndTable(ctx)
	if err != nil {
		return err
	}

	keys := make([]*secrets.DataKey, 0)
	if err := sqlDB.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(table).Find(&keys)
	}); err != nil {
		return err
	}

	for _, k := range keys {
		err := sqlDB.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
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

			if _, err := sess.Table(table).Where("name = ?", k.Id).Update(k); err != nil {
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
