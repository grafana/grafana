package schemaversion

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/hashicorp/golang-lru/v2/expirable"
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

// cachedProvider is a thread-safe TTL cache that wraps any fetch function.
type cachedProvider[T any] struct {
	fetch    func(context.Context) T
	cache    *expirable.LRU[string, T] // LRU cache: namespace to cache entry
	inFlight sync.Map                  // map[string]*sync.Mutex - per-namespace fetch locks
	logger   log.Logger
}

// newCachedProvider creates a new cachedProvider.
// The fetch function should be able to handle context with different namespaces.
// A non-positive size turns LRU mechanism off (cache of unlimited size).
// A non-positive cacheTTL disables TTL expiration.
func newCachedProvider[T any](fetch func(context.Context) T, size int, cacheTTL time.Duration, logger log.Logger) *cachedProvider[T] {
	cacheProvider := &cachedProvider[T]{
		fetch:  fetch,
		logger: logger,
	}
	cacheProvider.cache = expirable.NewLRU(size, func(key string, value T) {
		cacheProvider.inFlight.Delete(key)
	}, cacheTTL)
	return cacheProvider
}

// Get returns the cached value if it's still valid, otherwise calls fetch and caches the result.
func (p *cachedProvider[T]) Get(ctx context.Context) T {
	// Get namespace info from ctx
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		// No namespace, fall back to direct fetch call without caching
		p.logger.Warn("Unable to get namespace info from context, skipping cache", "error", err)
		return p.fetch(ctx)
	}

	namespace := nsInfo.Value
	// Fast path: check if cache is still valid
	if entry, ok := p.cache.Get(namespace); ok {
		return entry
	}

	// Get or create a per-namespace lock for this fetch operation
	// This ensures only one fetch happens per namespace at a time
	lockInterface, _ := p.inFlight.LoadOrStore(namespace, &sync.Mutex{})
	nsMutex := lockInterface.(*sync.Mutex)

	// Lock this specific namespace - other namespaces can still proceed
	nsMutex.Lock()
	defer nsMutex.Unlock()

	// Double-check: another goroutine might have already fetched while we waited
	if entry, ok := p.cache.Get(namespace); ok {
		return entry
	}

	// Fetch outside the main lock - only this namespace is blocked
	p.logger.Debug("cache miss or expired, fetching new value", "namespace", namespace)
	value := p.fetch(ctx)

	// Update the cache for this namespace
	p.cache.Add(namespace, value)

	return value
}

// Preload loads data into the cache for the given namespaces.
func (p *cachedProvider[T]) Preload(ctx context.Context, nsInfos []types.NamespaceInfo) {
	// Build the cache using a context with the namespace
	p.logger.Info("preloading cache", "nsInfos", len(nsInfos))
	startedAt := time.Now()
	defer func() {
		p.logger.Info("finished preloading cache", "nsInfos", len(nsInfos), "elapsed", time.Since(startedAt))
	}()
	for _, nsInfo := range nsInfos {
		p.cache.Add(nsInfo.Value, p.fetch(k8srequest.WithNamespace(ctx, nsInfo.Value)))
	}
}
