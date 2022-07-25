package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
)

type KVStoreWithFallback struct {
	log      log.Logger
	store    SecretsKVStore
	fallback SecretsKVStore
}

func NewKVStoreWithFallback(store SecretsKVStore, fallback SecretsKVStore) *KVStoreWithFallback {
	return &KVStoreWithFallback{
		log:      log.New("secrets.kvstore"),
		store:    store,
		fallback: fallback,
	}
}

func (kv *KVStoreWithFallback) Get(ctx context.Context, orgId int64, namespace string, typ string) (string, bool, error) {
	value, exists, err := kv.store.Get(ctx, orgId, namespace, typ)
	if err != nil || !exists {
		value, exists, err := kv.fallback.Get(ctx, orgId, namespace, typ)
		kv.log.Debug("failed to get secret with plugin, using fallback", "orgId", orgId, "type", typ, "namespace", namespace, "error", err)
		return value, exists, err
	}
	return value, exists, err
}

func (kv *KVStoreWithFallback) Set(ctx context.Context, orgId int64, namespace string, typ string, value string) error {
	return kv.store.Set(ctx, orgId, namespace, typ, value)
}

func (kv *KVStoreWithFallback) Del(ctx context.Context, orgId int64, namespace string, typ string) error {
	return kv.store.Del(ctx, orgId, namespace, typ)
}

func (kv *KVStoreWithFallback) Keys(ctx context.Context, orgId int64, namespace string, typ string) ([]Key, error) {
	keys, err := kv.store.Keys(ctx, orgId, namespace, typ)
	if err != nil {
		kv.log.Debug("failed to get secret keys with plugin, using fallback", "orgId", orgId, "type", typ, "namespace", namespace, "error", err)
		return kv.fallback.Keys(ctx, orgId, namespace, typ)
	}
	return keys, err
}

func (kv *KVStoreWithFallback) Rename(ctx context.Context, orgId int64, namespace string, typ string, newNamespace string) error {
	return kv.store.Rename(ctx, orgId, namespace, typ, newNamespace)
}
