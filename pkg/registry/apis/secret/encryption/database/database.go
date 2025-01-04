package database

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/secret/encryption"
)

type EncryptionStoreImpl struct {
	db    db.DB
	log   log.Logger
	table string
}

// TODO need to grab the DB wiring from the Ryan POC and pass the db service in here
func NewEncryptionStore(db db.DB) *EncryptionStoreImpl {
	store := &EncryptionStoreImpl{
		db:    db,
		log:   log.New("encryption.store"),
		table: "data_keys",
	}

	return store
}

func NewEncryptionStoreForTable(db db.DB, table string) *EncryptionStoreImpl {
	store := NewEncryptionStore(db)
	store.table = table
	return store
}

func (ss *EncryptionStoreImpl) GetDataKey(ctx context.Context, id string) (*encryption.DataKey, error) {
	dataKey := &encryption.DataKey{}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(ss.table).
			Where("name = ?", id).
			Get(dataKey)
		return err
	})

	if err != nil {
		return nil, fmt.Errorf("failed getting data key: %w", err)
	}

	if !exists {
		return nil, encryption.ErrDataKeyNotFound
	}

	return dataKey, nil
}

func (ss *EncryptionStoreImpl) GetCurrentDataKey(ctx context.Context, label string) (*encryption.DataKey, error) {
	dataKey := &encryption.DataKey{}
	var exists bool

	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		var err error
		exists, err = sess.Table(ss.table).
			Where("label = ? AND active = ?", label, ss.db.GetDialect().BooleanStr(true)).
			Get(dataKey)
		return err
	})

	if !exists {
		return nil, encryption.ErrDataKeyNotFound
	}

	if err != nil {
		return nil, fmt.Errorf("failed getting current data key: %w", err)
	}

	return dataKey, nil
}

func (ss *EncryptionStoreImpl) GetAllDataKeys(ctx context.Context) ([]*encryption.DataKey, error) {
	result := make([]*encryption.DataKey, 0)
	err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		err := sess.Table(ss.table).Find(&result)
		return err
	})
	return result, err
}

func (ss *EncryptionStoreImpl) CreateDataKey(ctx context.Context, dataKey *encryption.DataKey) error {
	if !dataKey.Active {
		return fmt.Errorf("cannot insert deactivated data keys")
	}

	dataKey.Created = time.Now()
	dataKey.Updated = dataKey.Created

	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(ss.table).Insert(dataKey)
		if err != nil {
			return err
		}

		return nil
	})
}

func (ss *EncryptionStoreImpl) DisableDataKeys(ctx context.Context) error {
	return ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(ss.table).
			Where("active = ?", ss.db.GetDialect().BooleanStr(true)).
			UseBool("active").Update(&encryption.DataKey{Active: false})
		return err
	})
}

func (ss *EncryptionStoreImpl) DeleteDataKey(ctx context.Context, id string) error {
	if len(id) == 0 {
		return fmt.Errorf("data key id is missing")
	}

	return ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		_, err := sess.Table(ss.table).Delete(&encryption.DataKey{Id: id})

		return err
	})
}

func (ss *EncryptionStoreImpl) ReEncryptDataKeys(
	ctx context.Context,
	providers map[encryption.ProviderID]encryption.Provider,
	currProvider encryption.ProviderID,
) error {
	keys := make([]*encryption.DataKey, 0)
	if err := ss.db.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.Table(ss.table).Find(&keys)
	}); err != nil {
		return err
	}

	for _, k := range keys {
		err := ss.db.WithTransactionalDbSession(ctx, func(sess *db.Session) error {
			provider, ok := providers[k.Provider]
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
			k.Label = encryption.KeyLabel(k.Scope, currProvider)
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

			if _, err := sess.Table(ss.table).Where("name = ?", k.Id).Update(k); err != nil {
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
