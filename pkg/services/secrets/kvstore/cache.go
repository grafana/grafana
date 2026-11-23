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
	log   log.Logger
	cache *localcache.CacheService
	store SecretsKVStore
}

func WithCache(store SecretsKVStore, defaultExpiration time.Duration, cleanupInterval time.Duration) *CachedKVStore {
	return &CachedKVStore{
		log:   log.New("secrets.kvstore"),
		cache: localcache.New(defaultExpiration, cleanupInterval),
		store: store,
	}
}

func (kv *CachedKVStore) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	key := fmt.Sprint(orgId, namespace, typ)
	if value, ok := kv.cache.Get(key); ok {
		kv.log.Debug("got secret value from cache", "orgId", orgId, "type", typ, "namespace", namespace)
		return fmt.Sprint(value), true, nil
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
	err := kv.store.Set(ctx, orgId, namespace, typ, value)
	if err != nil {
		return err
	}
	key := fmt.Sprint(orgId, namespace, typ)
	kv.cache.SetDefault(key, value)
	return nil
}

func (kv *CachedKVStore) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	err := kv.store.Del(ctx, orgId, namespace, typ)
	if err != nil {
		return err
	}
	key := fmt.Sprint(orgId, namespace, typ)
	kv.cache.Delete(key)
	return nil
}

func (kv *CachedKVStore) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	return kv.store.Keys(ctx, orgId, namespace, typ)
}

func (kv *CachedKVStore) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	err := kv.store.Rename(ctx, orgId, namespace, typ, newNamespace)
	if err != nil {
		return err
	}
	key := fmt.Sprint(orgId, namespace, typ)
	if value, ok := kv.cache.Get(key); ok {
		newKey := fmt.Sprint(orgId, newNamespace, typ)
		kv.cache.SetDefault(newKey, value)
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
