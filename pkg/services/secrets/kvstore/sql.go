package kvstore

import (
	"context"
	"encoding/base64"
	"errors"
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

var (
	b64                   = base64.RawStdEncoding
	errFallbackNotAllowed = errors.New("fallback not allowed for sql secret store")
)

// Get an item from the store
func (kv *secretsKVStoreSQL) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	item := Item{
		OrgId:     &orgId,
		Namespace: &namespace,
		Type:      &typ,
	}
	var isFound bool
	var decryptedValue []byte

	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Error("error getting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}
		if !has {
			kv.log.Debug("secret value not found", "orgId", orgId, "type", typ, "namespace", namespace)
			return nil
		}
		isFound = true
		return nil
	})

	if err == nil && isFound {
		decryptedValue, err = kv.getDecryptedValue(ctx, item)
		if err != nil {
			kv.log.Error("error decrypting secret value", "orgId", item.OrgId, "type", item.Type, "namespace", item.Namespace, "err", err)
			return string(decryptedValue), isFound, err
		}
	}

	kv.log.Debug("got secret value", "orgId", orgId, "type", typ, "namespace", namespace)
	return string(decryptedValue), isFound, err
}

// Set an item in the store
func (kv *secretsKVStoreSQL) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	encryptedValue, err := kv.secretsService.Encrypt(ctx, []byte(value), secrets.WithoutScope())
	if err != nil {
		kv.log.Error("error encrypting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		return err
	}
	encodedValue := b64.EncodeToString(encryptedValue)
	return kv.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Error("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		if has && item.Value == encodedValue {
			kv.log.Debug("secret value not changed", "orgId", orgId, "type", typ, "namespace", namespace)
			return nil
		}

		item.Value = encodedValue
		item.Updated = time.Now()

		if has {
			// if item already exists we update it
			_, err = dbSession.ID(item.Id).Update(&item)
			if err != nil {
				kv.log.Error("error updating secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.decryptionCache.Lock()
				defer kv.decryptionCache.Unlock()
				kv.decryptionCache.cache[item.Id] = cachedDecrypted{
					updated: item.Updated,
					value:   value,
				}
				kv.log.Debug("secret value updated", "orgId", orgId, "type", typ, "namespace", namespace)
			}
			return err
		}

		// if item doesn't exist we create it
		item.Created = item.Updated
		_, err = dbSession.Insert(&item)
		if err != nil {
			kv.log.Error("error inserting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		} else {
			kv.log.Debug("secret value inserted", "orgId", orgId, "type", typ, "namespace", namespace)
		}
		return err
	})
}

// Del deletes an item from the store.
func (kv *secretsKVStoreSQL) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Error("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		if has {
			// if item exists we delete it
			_, err = dbSession.ID(item.Id).Delete(&item)
			if err != nil {
				kv.log.Error("error deleting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.decryptionCache.Lock()
				defer kv.decryptionCache.Unlock()
				delete(kv.decryptionCache.cache, item.Id)
				kv.log.Debug("secret value deleted", "orgId", orgId, "type", typ, "namespace", namespace)
			}
			return err
		}
		return nil
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

// Rename an item in the store
func (kv *secretsKVStoreSQL) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	return kv.sqlStore.WithTransactionalDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Get(&item)
		if err != nil {
			kv.log.Error("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		item.Namespace = &newNamespace
		item.Updated = time.Now()

		if has {
			// if item already exists we update it
			_, err = dbSession.ID(item.Id).Update(&item)
			if err != nil {
				kv.log.Error("error updating secret namespace", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.log.Debug("secret namespace updated", "orgId", orgId, "type", typ, "namespace", namespace)
			}
			return err
		}

		return err
	})
}

// GetAll this returns all the secrets stored in the database. This is not part of the kvstore interface as we
// only need it for migration from sql to plugin at this moment
func (kv *secretsKVStoreSQL) GetAll(ctx context.Context) ([]Item, error) {
	var items []Item
	err := kv.sqlStore.WithDbSession(ctx, func(dbSession *sqlstore.DBSession) error {
		return dbSession.Find(&items)
	})
	if err != nil {
		kv.log.Error("error getting all the items", "err", err)
		return nil, err
	}

	// decrypting values
	for i := range items {
		value, err := kv.getDecryptedValue(ctx, items[i])
		items[i].Value = string(value)
		if err != nil {
			kv.log.Error("error decrypting secret value", "orgId", items[i].OrgId, "type", items[i].Type, "namespace", items[i].Namespace, "err", err)
		}
	}

	return items, err
}

func (kv *secretsKVStoreSQL) Fallback() SecretsKVStore {
	return nil
}

func (kv *secretsKVStoreSQL) SetFallback(_ SecretsKVStore) error {
	return errFallbackNotAllowed
}

func (kv *secretsKVStoreSQL) getDecryptedValue(ctx context.Context, item Item) ([]byte, error) {
	kv.decryptionCache.Lock()
	defer kv.decryptionCache.Unlock()
	var decryptedValue []byte
	var err error

	if cache, ok := kv.decryptionCache.cache[item.Id]; ok && item.Updated.Equal(cache.updated) {
		return []byte(cache.value), err
	}

	decodedValue, err := b64.DecodeString(item.Value)
	if err != nil {
		return decryptedValue, err
	}

	decryptedValue, err = kv.secretsService.Decrypt(ctx, decodedValue)
	if err != nil {
		return decryptedValue, err
	}

	kv.decryptionCache.cache[item.Id] = cachedDecrypted{
		updated: item.Updated,
		value:   string(decryptedValue),
	}

	return decryptedValue, err
}
