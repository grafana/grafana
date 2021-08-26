package kvstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore) KVStore {
	s := &kvStoreSQL{
		sqlStore: sqlStore,
		log:      log.New("infra.kvstore.sql"),
	}

	return s
}

// Interface for kvstore
type KVStore interface {
	Get(ctx context.Context, orgId int64, namespace string, key string) (string, error)
	Set(ctx context.Context, orgId int64, namespace string, key string, value string) error
}

// Returns a kvstore wrapper with fixed orgId and namespace
func WithNamespace(kv KVStore, orgId int64, namespace string) *NamespacedKVStore {
	return &NamespacedKVStore{
		kvStore:   kv,
		orgId:     orgId,
		namespace: namespace,
	}
}

type NamespacedKVStore struct {
	kvStore   KVStore
	orgId     int64
	namespace string
}

func (kv *NamespacedKVStore) Get(ctx context.Context, key string) (string, error) {
	return kv.kvStore.Get(ctx, kv.orgId, kv.namespace, key)
}

func (kv *NamespacedKVStore) Set(ctx context.Context, key string, value string) error {
	return kv.kvStore.Set(ctx, kv.orgId, kv.namespace, key, value)
}
