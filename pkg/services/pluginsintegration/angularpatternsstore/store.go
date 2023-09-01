package angularpatternsstore

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/cachekvstore"
)

type Service interface {
	cachekvstore.LastUpdateGetter
	Get(ctx context.Context) (string, bool, error)
	Set(ctx context.Context, value any) error
}

const (
	kvNamespace = "plugin.angularpatterns"
	keyPatterns = "angular_patterns"
)

// KVStoreService allows to cache GCOM angular patterns into the database, as a cache.
type KVStoreService struct {
	*cachekvstore.NamespacedStore
}

var _ Service = (*KVStoreService)(nil)

func ProvideService(kv kvstore.KVStore) Service {
	return &KVStoreService{
		NamespacedStore: cachekvstore.NewNamespacedStore(kv, kvNamespace),
	}
}

// Get returns the stored angular patterns from the underlying cachekvstore.
func (s *KVStoreService) Get(ctx context.Context) (string, bool, error) {
	return s.NamespacedStore.Get(ctx, keyPatterns)
}

// Set stores the given angular patterns in the underlying cachekvstore.
// TODO: change signature so `value` accepts only the correct type?
func (s *KVStoreService) Set(ctx context.Context, value any) error {
	return s.NamespacedStore.Set(ctx, keyPatterns, value)
}
