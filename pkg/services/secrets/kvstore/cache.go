package kvstore

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
)

var errSecretStoreIsNotCached = errors.New("SecretsKVStore is not a CachedKVStore")

type CachedKVStore struct {
	log      log.Logger
	cache    *localcache.CacheService
	store    SecretsKVStore
	tenantOf func(ctx context.Context) (tenant, error)
}

// cachedValue keeps the tenant next to the value. Holding the tenant's DB here also keeps it from
// being garbage collected while the entry lives, so its address in the cache key cannot be reused
// by another tenant's DB.
type cachedValue struct {
	tenant tenant
	value  string
}

func WithCache(store SecretsKVStore, defaultExpiration time.Duration, cleanupInterval time.Duration) *CachedKVStore {
	tenantOf := func(context.Context) (tenant, error) { return tenant{}, nil }
	if sqlStore, ok := store.(*SecretsKVStoreSQL); ok {
		tenantOf = sqlStore.tenantOf
	}
	return &CachedKVStore{
		log:      log.New("secrets.kvstore"),
		cache:    localcache.New(defaultExpiration, cleanupInterval),
		store:    store,
		tenantOf: tenantOf,
	}
}

func cacheKey(t tenant, orgId int64, namespace string, typ string) string {
	return fmt.Sprintf("%p|%s|%d|%s|%s", t.db, t.table, orgId, namespace, typ)
}

func (kv *CachedKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return "", false, err
	}
	key := cacheKey(t, orgId, namespace, typ)
	if cached, ok := kv.cache.Get(key); ok {
		if cv, ok := cached.(cachedValue); ok && cv.tenant == t {
			kv.log.Debug("got secret value from cache", "orgId", orgId, "type", typ, "namespace", namespace)
			return cv.value, true, nil
		}
	}
	value, ok, err := kv.store.Get(ctx, orgId, namespace, typ)
	if err != nil {
		return "", false, err
	}
	if ok {
		kv.cache.SetDefault(key, cachedValue{tenant: t, value: value})
	}
	return value, ok, err
}

func (kv *CachedKVStore) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	if err := kv.store.Set(ctx, orgId, namespace, typ, value); err != nil {
		return err
	}
	kv.cache.SetDefault(cacheKey(t, orgId, namespace, typ), cachedValue{tenant: t, value: value})
	return nil
}

func (kv *CachedKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	if err := kv.store.Del(ctx, orgId, namespace, typ); err != nil {
		return err
	}
	kv.cache.Delete(cacheKey(t, orgId, namespace, typ))
	return nil
}

func (kv *CachedKVStore) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	return kv.store.Keys(ctx, orgId, namespace, typ)
}

func (kv *CachedKVStore) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	t, err := kv.tenantOf(ctx)
	if err != nil {
		return err
	}
	if err := kv.store.Rename(ctx, orgId, namespace, typ, newNamespace); err != nil {
		return err
	}
	key := cacheKey(t, orgId, namespace, typ)
	if value, ok := kv.cache.Get(key); ok {
		kv.cache.SetDefault(cacheKey(t, orgId, newNamespace, typ), value)
		kv.cache.Delete(key)
	}
	return nil
}

func (kv *CachedKVStore) GetAll(ctx context.Context) ([]Item, error) {
	return kv.store.GetAll(ctx)
}

func GetUnwrappedStoreFromCache(kv SecretsKVStore) (SecretsKVStore, error) {
	if cache, ok := kv.(*CachedKVStore); ok {
		return cache.store, nil
	}
	return nil, errSecretStoreIsNotCached
}
