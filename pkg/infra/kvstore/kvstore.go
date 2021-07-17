package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func init() {
	registry.RegisterService(&KVStore{})
}

// Key/value store service
type KVStore struct {
	SQLStore *sqlstore.SQLStore `inject:""`
	backend  KVStoreBackend
}

func (kv *KVStore) Init() error {
	// currently we only support a SQL backend
	kv.backend = &KVStoreSQL{
		SQLStore: kv.SQLStore,
	}

	return kv.backend.Init()
}

func (kv *KVStore) Get(ctx context.Context, orgId int64, namespace string, key string) (string, error) {
	return kv.backend.Get(ctx, orgId, namespace, key)
}

func (kv *KVStore) Set(ctx context.Context, orgId int64, namespace string, key string, value string) error {
	return kv.backend.Set(ctx, orgId, namespace, key, value)
}

// Returns a kvstore wrapper with fixed orgId and namespace
func (kv *KVStore) WithNamespace(orgId int64, namespace string) *NamespacedKVStore {
	return &NamespacedKVStore{
		kvStore:   kv,
		orgId:     orgId,
		namespace: namespace,
	}
}

type NamespacedKVStore struct {
	kvStore   *KVStore
	orgId     int64
	namespace string
}

func (kv *NamespacedKVStore) Get(ctx context.Context, key string) (string, error) {
	return kv.kvStore.Get(ctx, kv.orgId, kv.namespace, key)
}

func (kv *NamespacedKVStore) Set(ctx context.Context, key string, value string) error {
	return kv.kvStore.Set(ctx, kv.orgId, kv.namespace, key, value)
}

// Interface for all kvstore backends
type KVStoreBackend interface {
	Init() error
	Get(ctx context.Context, orgId int64, namespace string, key string) (string, error)
	Set(ctx context.Context, orgId int64, namespace string, key string, value string) error
}
