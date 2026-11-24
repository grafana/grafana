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
	log       log.Logger
	cache     *localcache.CacheService
	store     SecretsKVStore
	tenantKey func(ctx context.Context) (string, error)
}

func WithCache(store SecretsKVStore, defaultExpiration time.Duration, cleanupInterval time.Duration) *CachedKVStore {
	tenantKey := func(context.Context) (string, error) { return "", nil }
	if sqlStore, ok := store.(*SecretsKVStoreSQL); ok {
		tenantKey = func(ctx context.Context) (string, error) {
			t, err := sqlStore.tenantOf(ctx)
			return t.key, err
		}
	}
	return &CachedKVStore{
		log:       log.New("secrets.kvstore"),
		cache:     localcache.New(defaultExpiration, cleanupInterval),
		store:     store,
		tenantKey: tenantKey,
	}
}

func cacheKey(tenantKey string, orgId int64, namespace string, typ string) string {
	return fmt.Sprintf("%s|%d|%s|%s", tenantKey, orgId, namespace, typ)
}

func (kv *CachedKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	t, err := kv.tenantKey(ctx)
	if err != nil {
		return "", false, err
	}
	key := cacheKey(t, orgId, namespace, typ)
	if cached, ok := kv.cache.Get(key); ok {
		kv.log.Debug("got secret value from cache", "orgId", orgId, "type", typ, "namespace", namespace)
		return fmt.Sprint(cached), true, nil
	}
	value, ok, err := kv.store.Get(ctx, orgId, namespace, typ)
	if err != nil {
		return "", false, err
	}
	if ok {
		kv.cache.SetDefault(key, value)
	}
	return value, ok, err
}

func (kv *CachedKVStore) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	t, err := kv.tenantKey(ctx)
	if err != nil {
		return err
	}
	if err := kv.store.Set(ctx, orgId, namespace, typ, value); err != nil {
		return err
	}
	kv.cache.SetDefault(cacheKey(t, orgId, namespace, typ), value)
	return nil
}

func (kv *CachedKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	t, err := kv.tenantKey(ctx)
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
	t, err := kv.tenantKey(ctx)
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
