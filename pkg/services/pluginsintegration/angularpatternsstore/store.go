package angularpatternsstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/cachekvstore"
)

type Service interface {
	Get(ctx context.Context) (string, bool, error)
	Set(ctx context.Context, patterns any) error
	GetLastUpdated(ctx context.Context) (time.Time, error)
}

const (
	kvNamespace = "plugin.angularpatterns"

	keyPatterns    = "angular_patterns"
	keyLastUpdated = "last_updated"
)

// KVStoreService allows to cache GCOM angular patterns into the database, as a cache.
type KVStoreService struct {
	cachekvstore.SingleKeyStore
}

func ProvideService(kv kvstore.KVStore) Service {
	return &KVStoreService{
		SingleKeyStore: cachekvstore.NewSingleKeyNamespacedStore(
			kv, kvNamespace, keyPatterns,
			cachekvstore.WithLastUpdatedKey(keyLastUpdated),
		),
	}
}

func (s *KVStoreService) Set(ctx context.Context, patterns any) error {
	return s.SingleKeyStore.Set(ctx, cachekvstore.NewJSONMarshaler(patterns))
}
