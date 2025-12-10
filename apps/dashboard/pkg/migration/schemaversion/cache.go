package schemaversion

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	lru "github.com/hashicorp/golang-lru/v2"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

const defaultCacheSize = 1000

// CacheProvider is a generic cache interface for schema version providers.
type CacheProvider[T any] interface {
	// Get returns the cached value if it's still valid, otherwise calls fetch and caches the result.
	Get(ctx context.Context) T
}

// PreloadableCache is an interface for providers that support preloading the cache.
type PreloadableCache interface {
	// Preload loads data into the cache for the given namespaces.
	Preload(ctx context.Context, nsInfos []types.NamespaceInfo)
}

// cacheEntry holds a cached value for a specific namespace with its timestamp.
type cacheEntry[T any] struct {
	value    T
	cachedAt time.Time
}

// cachedProvider is a thread-safe TTL cache that wraps any fetch function.
type cachedProvider[T any] struct {
	fetch    func(context.Context) T
	entries  *lru.Cache[string, *cacheEntry[T]] // LRU cache: namespace to cache entry
	cacheTTL time.Duration
	inFlight sync.Map // map[string]*sync.Mutex - per-namespace fetch locks
	logger   log.Logger
}

// newCachedProvider creates a new cachedProvider.
// The fetch function should be able to handle context with different namespaces.
// If cacheTTL is 0 or negative, Get() will call fetch() directly without caching.
func newCachedProvider[T any](fetch func(context.Context) T, size int, cacheTTL time.Duration, logger log.Logger) (*cachedProvider[T], error) {
	cacheProvider := &cachedProvider[T]{
		fetch:    fetch,
		cacheTTL: cacheTTL,
		logger:   logger,
	}
	// Create LRU cache with a maximum of 1000 namespace entries
	var err error
	cacheProvider.entries, err = lru.NewWithEvict[string, *cacheEntry[T]](size, func(key string, value *cacheEntry[T]) {
		cacheProvider.inFlight.Delete(key)
	})
	return cacheProvider, err
}

// Get returns the cached value if it's still valid, otherwise calls fetch and caches the result.
func (p *cachedProvider[T]) Get(ctx context.Context) T {
	// If caching is disabled or cache was not initialized, call fetch directly
	if p.cacheTTL <= 0 || p.entries == nil {
		return p.fetch(ctx)
	}

	// Get namespace info from ctx
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		// No namespace, fall back to direct fetch call without caching
		p.logger.Warn("Unable to get namespace info from context, skipping cache", "error", err)
		return p.fetch(ctx)
	}

	namespace := nsInfo.Value

	// Fast path: check if cache is still valid
	if entry, ok := p.entries.Get(namespace); ok && time.Since(entry.cachedAt) < p.cacheTTL {
		value := entry.value
		return value
	}

	// Get or create a per-namespace lock for this fetch operation
	// This ensures only one fetch happens per namespace at a time
	lockInterface, _ := p.inFlight.LoadOrStore(namespace, &sync.Mutex{})
	nsMutex := lockInterface.(*sync.Mutex)

	// Lock this specific namespace - other namespaces can still proceed
	nsMutex.Lock()
	defer nsMutex.Unlock()

	// Double-check: another goroutine might have already fetched while we waited
	if entry, ok := p.entries.Get(namespace); ok && time.Since(entry.cachedAt) < p.cacheTTL {
		value := entry.value
		return value
	}

	// Fetch outside the main lock - only this namespace is blocked
	p.logger.Debug("cache miss or expired, fetching new value", "namespace", namespace)
	value := p.fetch(ctx)

	// Update the cache for this namespace
	p.entries.Add(namespace, &cacheEntry[T]{
		value:    value,
		cachedAt: time.Now(),
	})

	return value
}

// Preload loads data into the cache for the given namespaces.
func (p *cachedProvider[T]) Preload(ctx context.Context, nsInfos []types.NamespaceInfo) {
	if p.cacheTTL <= 0 || p.entries == nil {
		return // Caching disabled, nothing to preload
	}

	// Build the cache using a context with the namespace
	p.logger.Info("preloading cache", "nsInfos", len(nsInfos))
	startedAt := time.Now()
	defer func() {
		p.logger.Info("finished preloading cache", "nsInfos", len(nsInfos), "elapsed", time.Since(startedAt))
	}()
	for _, nsInfo := range nsInfos {
		value := p.fetch(k8srequest.WithNamespace(ctx, nsInfo.Value))
		p.entries.Add(nsInfo.Value, &cacheEntry[T]{
			value:    value,
			cachedAt: time.Now(),
		})
	}
}
