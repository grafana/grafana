package angularpatternsstore

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/cachekvstore"
)

type Service interface {
	GetLastUpdated(ctx context.Context) (time.Time, error)

	Get(ctx context.Context) (string, bool, error)
	Set(ctx context.Context, value any) error
	SetLastUpdated(ctx context.Context) error

	GetETag(ctx context.Context) (string, bool, error)
	SetETag(ctx context.Context, etag string) error
}

const (
	kvNamespace = "plugin.angularpatterns"
	keyPatterns = "angular_patterns"
	keyEtag     = "etag"
)

// KVStoreService allows to cache GCOM angular patterns into the database, as a cache.
type KVStoreService struct {
	*cachekvstore.CacheKvStore
}

var _ Service = (*KVStoreService)(nil)

func ProvideService(kv kvstore.KVStore) Service {
	return &KVStoreService{
		CacheKvStore: cachekvstore.NewCacheKvStore(kv, kvNamespace),
	}
}

// Get returns the stored angular patterns from the underlying cachekvstore.
func (s *KVStoreService) Get(ctx context.Context) (string, bool, error) {
	return s.CacheKvStore.Get(ctx, keyPatterns)
}

// GetETag returns the stored etag from the underlying cachekvstore.
func (s *KVStoreService) GetETag(ctx context.Context) (string, bool, error) {
	return s.CacheKvStore.Get(ctx, keyEtag)
}

// Set stores the given angular patterns in the underlying cachekvstore.
func (s *KVStoreService) Set(ctx context.Context, value any) error {
	return s.CacheKvStore.Set(ctx, keyPatterns, value)
}

// SetETag stores the given etag in the underlying cachekvstore.
func (s *KVStoreService) SetETag(ctx context.Context, etag string) error {
	return s.CacheKvStore.Set(ctx, keyEtag, etag)
}
