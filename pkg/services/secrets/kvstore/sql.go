package kvstore

import (
	"context"
	"encoding/base64"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/storage/legacysql"
)

const secretsTable = "secrets"

// SecretsKVStoreSQL provides a key/value store backed by the Grafana database
type SecretsKVStoreSQL struct {
	log             log.Logger
	dbProvider      legacysql.LegacyDatabaseProvider
	secretsService  secrets.Service //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	decryptionCache decryptionCache
}

// tenant identifies where a tenant's secrets live. Two tenants share rows only if they share both
// the database and the table, so the pair is what every cache must be keyed by.
type tenant struct {
	db    db.DB
	table string
}

type decryptionCacheKey struct {
	tenant tenant
	id     int64
}

type decryptionCache struct {
	cache map[decryptionCacheKey]cachedDecrypted
	sync.Mutex
}

type cachedDecrypted struct {
	updated time.Time
	value   string
}

var b64 = base64.RawStdEncoding

func NewSQLSecretsKVStore(dbProvider legacysql.LegacyDatabaseProvider,
	secretsService secrets.Service, //nolint:staticcheck // SA1019: Legacy envelope encryption for single-tenant feature
	logger log.Logger,
) *SecretsKVStoreSQL {
	return &SecretsKVStoreSQL{
		dbProvider:     dbProvider,
		secretsService: secretsService,
		log:            logger,
		decryptionCache: decryptionCache{
			cache: make(map[decryptionCacheKey]cachedDecrypted),
		},
	}
}

// tenantOf resolves the database and secrets table for the tenant in ctx.
func (kv *SecretsKVStoreSQL) tenantOf(ctx context.Context) (tenant, error) {
	helper, err := kv.dbProvider(ctx)
	if err != nil {
		return tenant{}, err
	}
	return tenant{db: helper.DB, table: helper.Table(secretsTable)}, nil
}

// Get an item from the store
func (kv *SecretsKVStoreSQL) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return "", false, err
	}
	item := Item{
		OrgId:     &orgId,
		Namespace: &namespace,
		Type:      &typ,
	}
	var isFound bool
	var decryptedValue []byte

	err = t.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		has, err := dbSession.Table(t.table).Get(&item)
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
		decryptedValue, err = kv.getDecryptedValue(ctx, t, item)
		if err != nil {
			kv.log.Error("error decrypting secret value", "orgId", item.OrgId, "type", item.Type, "namespace", item.Namespace, "err", err)
			return string(decryptedValue), isFound, err
		}
	}

	kv.log.Debug("got secret value", "orgId", orgId, "type", typ, "namespace", namespace)
	return string(decryptedValue), isFound, err
}

// Set an item in the store
func (kv *SecretsKVStoreSQL) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	encryptedValue, err := kv.secretsService.Encrypt(ctx, []byte(value), secrets.WithoutScope())
	if err != nil {
		kv.log.Error("error encrypting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		return err
	}
	encodedValue := b64.EncodeToString(encryptedValue)
	return t.db.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Table(t.table).Get(&item)
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
			_, err = dbSession.Table(t.table).ID(item.Id).Update(&item)
			if err != nil {
				kv.log.Error("error updating secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.decryptionCache.Lock()
				defer kv.decryptionCache.Unlock()
				kv.decryptionCache.cache[decryptionCacheKey{tenant: t, id: item.Id}] = cachedDecrypted{
					updated: item.Updated,
					value:   value,
				}
				kv.log.Debug("secret value updated", "orgId", orgId, "type", typ, "namespace", namespace)
			}
			return err
		}

		// if item doesn't exist we create it
		item.Created = item.Updated
		_, err = dbSession.Table(t.table).Insert(&item)
		if err != nil {
			kv.log.Error("error inserting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
		} else {
			kv.log.Debug("secret value inserted", "orgId", orgId, "type", typ, "namespace", namespace)
		}
		return err
	})
}

// Del deletes an item from the store.
func (kv *SecretsKVStoreSQL) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	err = t.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Table(t.table).Get(&item)
		if err != nil {
			kv.log.Error("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		if has {
			// if item exists we delete it
			_, err = dbSession.Table(t.table).ID(item.Id).Delete(&item)
			if err != nil {
				kv.log.Error("error deleting secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			} else {
				kv.decryptionCache.Lock()
				defer kv.decryptionCache.Unlock()
				delete(kv.decryptionCache.cache, decryptionCacheKey{tenant: t, id: item.Id})
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
func (kv *SecretsKVStoreSQL) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return nil, err
	}
	var keys []Key
	err = t.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		query := dbSession.Table(t.table).Where("namespace = ?", namespace).And("type = ?", typ)
		if orgId != AllOrganizations {
			query.And("org_id = ?", orgId)
		}
		return query.Find(&keys)
	})
	return keys, err
}

// Rename an item in the store
func (kv *SecretsKVStoreSQL) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	return t.db.WithTransactionalDbSession(ctx, func(dbSession *db.Session) error {
		item := Item{
			OrgId:     &orgId,
			Namespace: &namespace,
			Type:      &typ,
		}

		has, err := dbSession.Table(t.table).Get(&item)
		if err != nil {
			kv.log.Error("error checking secret value", "orgId", orgId, "type", typ, "namespace", namespace, "err", err)
			return err
		}

		item.Namespace = &newNamespace
		item.Updated = time.Now()

		if has {
			// if item already exists we update it
			_, err = dbSession.Table(t.table).ID(item.Id).Update(&item)
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
func (kv *SecretsKVStoreSQL) GetAll(ctx context.Context) ([]Item, error) {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return nil, err
	}
	var items []Item
	err = t.db.WithDbSession(ctx, func(dbSession *db.Session) error {
		return dbSession.Table(t.table).Find(&items)
	})
	if err != nil {
		kv.log.Error("error getting all the items", "err", err)
		return nil, err
	}

	// decrypting values
	for i := range items {
		value, err := kv.getDecryptedValue(ctx, t, items[i])
		items[i].Value = string(value)
		if err != nil {
			kv.log.Error("error decrypting secret value", "orgId", items[i].OrgId, "type", items[i].Type, "namespace", items[i].Namespace, "err", err)
		}
	}

	return items, err
}

func (kv *SecretsKVStoreSQL) getDecryptedValue(ctx context.Context, t tenant, item Item) ([]byte, error) {
	kv.decryptionCache.Lock()
	defer kv.decryptionCache.Unlock()
	var decryptedValue []byte
	var err error

	if cache, ok := kv.decryptionCache.cache[decryptionCacheKey{tenant: t, id: item.Id}]; ok && item.Updated.Equal(cache.updated) {
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

	kv.decryptionCache.cache[decryptionCacheKey{tenant: t, id: item.Id}] = cachedDecrypted{
		updated: item.Updated,
		value:   string(decryptedValue),
	}

	return decryptedValue, err
}
