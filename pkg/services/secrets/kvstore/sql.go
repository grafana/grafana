package kvstore

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// secretsKVStoreSQL provides a key/value store backed by the Grafana database
type secretsKVStoreSQL struct {
	log            log.Logger
	sqlStore       sqlstore.Store
	secretsService secrets.Service
}

// Get an item from the store
func (kv *secretsKVStoreSQL) Get(ctx context.Context, orgId int64, typ string, key string) (string, bool, error) {
	item := Item{
		OrgId: &orgId,
		Type:  &typ,
		Key:   &key,
	}
	var itemFound bool
	var decryptedValue []byte

	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error getting secret value", "orgId", orgId, "type", typ, "key", key, "err", err)
			return err
		}
		if !has {
			kv.log.Debug("secret value not found", "orgId", orgId, "type", typ, "key", key)
			return nil
		}
		itemFound = true
		kv.log.Debug("got secret value", "orgId", orgId, "type", typ, "key", key, "value", item.Value)
		decryptedValue, err = kv.secretsService.Decrypt(ctx, []byte(item.Value))
		if err != nil {
			return err
		}
		return nil
	})

	return string(decryptedValue), itemFound, err
}

// Set an item in the store
func (kv *secretsKVStoreSQL) Set(ctx context.Context, orgId int64, typ string, key string, value string) error {
	encryptedValue, err := kv.secretsService.Encrypt(ctx, []byte(value), secrets.WithoutScope())
	if err != nil {
		kv.log.Debug("error encrypting secret value", "orgId", orgId, "type", typ, "key", key, "err", err)
		return err
	}
	return kv.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		item := Item{
			OrgId: &orgId,
			Type:  &typ,
			Key:   &key,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error checking secret value", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue, "err", err)
			return err
		}

		if has && item.Value == value {
			kv.log.Debug("secret value not changed", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue)
			return nil
		}

		item.Value = value
		item.Updated = time.Now()

		if has {
			_, err = dbSession.ID(item.Id).Update(&item)
			if err != nil {
				kv.log.Debug("error updating secret value", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue, "err", err)
			} else {
				kv.log.Debug("secret value updated", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue)
			}
			return err
		}

		item.Created = item.Updated
		_, err = dbSession.Insert(&item)
		if err != nil {
			kv.log.Debug("error inserting secret value", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue, "err", err)
		} else {
			kv.log.Debug("secret value inserted", "orgId", orgId, "type", typ, "key", key, "value", encryptedValue)
		}
		return err
	})
}

// Del deletes an item from the store.
func (kv *secretsKVStoreSQL) Del(ctx context.Context, orgId int64, typ string, key string) error {
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query := fmt.Sprintf("DELETE FROM secrets WHERE org_id=? and type=? and %s=?", kv.sqlStore.Quote("key"))
		_, err := dbSession.Exec(query, orgId, typ, key)
		return err
	})
	return err
}

// Keys get all keys for a given type and keyPrefix. To query for all
// organizations the constant 'secret.AllOrganizations' can be passed as orgId.
func (kv *secretsKVStoreSQL) Keys(ctx context.Context, orgId int64, typ string, keyPrefix string) ([]Key, error) {
	var keys []Key
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query := dbSession.Where("type = ?", typ).And(fmt.Sprintf("%s LIKE ?", kv.sqlStore.Quote("key")), keyPrefix+"%")
		if orgId != AllOrganizations {
			query.And("org_id = ?", orgId)
		}
		return query.Find(&keys)
	})
	return keys, err
}
