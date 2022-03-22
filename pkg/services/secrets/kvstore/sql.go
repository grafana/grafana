package kvstore

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// secretsKVStoreSQL provides a key/value store backed by the Grafana database
type secretsKVStoreSQL struct {
	log             log.Logger
	sqlStore        sqlstore.Store
	secretsService  secrets.Service
	decryptionCache decryptionCache
}

type decryptionCache struct {
	cache map[int64]cachedDecrypted
	sync.Mutex
}

type cachedDecrypted struct {
	updated time.Time
	value   string
}

// Get an item from the store
func (kv *secretsKVStoreSQL) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	item := Item{
		OrgId:     &orgId,
		Namespace: &namespace,
		Type:      &typ,
	}
	var itemFound bool
	var decryptedValue []byte

	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error getting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}
		if !has {
			kv.log.Debug("secret value not found", "orgId", orgId, "type", typ, "namespace", namespace)
			return nil
		}
		itemFound = true
		kv.log.Debug("got secret value", "orgId", orgId, "type", typ, "namespace", namespace, "value", item.Value)
		return nil
	})

	if err == nil && itemFound {
		kv.decryptionCache.Lock()
		defer kv.decryptionCache.Unlock()

		if cache, present := kv.decryptionCache.cache[item.Id]; present && item.Updated.Equal(cache.updated) {
			return cache.value, itemFound, err
		}

		decryptedValue, err = kv.secretsService.Decrypt(ctx, []byte(item.Value))
		kv.decryptionCache.cache[item.Id] = cachedDecrypted{
			updated: item.Updated,
			value:   string(decryptedValue),
		}
	}

	return string(decryptedValue), itemFound, err
}

// Set an item in the store
func (kv *secretsKVStoreSQL) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	encryptedValue, err := kv.secretsService.Encrypt(ctx, []byte(value), secrets.WithoutScope())
	if err != nil {
		kv.log.Debug("error encrypting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		return err
	}
	return kv.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Debug("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		if has && item.Value == value {
			kv.log.Debug("secret value not changed", "orgId", orgId, "type", typ, "namespace", namespace)
			return nil
		}

		item.Value = string(encryptedValue)
		item.Updated = time.Now()

		if has {
			_, err = dbSession.ID(item.Id).Update(&item)
			if err != nil {
				kv.log.Debug("error updating secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.log.Debug("secret value updated", "orgId", orgId, "type", typ, "namespace", namespace)
			}
			return err
		}

		item.Created = item.Updated
		_, err = dbSession.Insert(&item)
		if err != nil {
			kv.log.Debug("error inserting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		} else {
			kv.log.Debug("secret value inserted", "orgId", orgId, "type", typ, "namespace", namespace)
		}
		return err
	})
}

// Del deletes an item from the store.
func (kv *secretsKVStoreSQL) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		kv.log.Debug("deleting secret value", "orgId", orgId, "type", typ, "namespace", namespace)
		query := fmt.Sprintf("DELETE FROM secrets WHERE org_id=? and type=? and %s=?", kv.sqlStore.Quote("namespace"))
		_, err := dbSession.Exec(query, orgId, typ, namespace)
		return err
	})
	return err
}

// Keys get all keys for a given namespace. To query for all
// organizations the constant 'kvstore.AllOrganizations' can be passed as orgId.
func (kv *secretsKVStoreSQL) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	var keys []Key
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		query := dbSession.Where("namespace = ?", namespace).And("type = ?", typ)
		if orgId != AllOrganizations {
			query.And("org_id = ?", orgId)
		}
		return query.Find(&keys)
	})
	return keys, err
}
