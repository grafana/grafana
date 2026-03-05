package cache

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

// toEntry is a helper to type-assert sync.Map values to *cacheEntry.
func toEntry(val any) *cacheEntry {
	return val.(*cacheEntry)
}

const (
	defaultCleanupInterval = 10 * time.Minute

	// DefaultMetricsCacheTTL is the default TTL for cached metrics.
	// Providers can use this when created if they don't need custom TTL.
	DefaultMetricsCacheTTL = 5 * time.Minute
)

// cacheEntry represents a cached metrics list with expiration time.
// The metricsSet is built eagerly alongside the slice to avoid repeated
// []string → map[string]bool conversions on every validation call.
type cacheEntry struct {
	metrics    []string
	metricsSet map[string]bool
	expiresAt  time.Time
}

// MetricsCache provides TTL-based caching for metrics fetched from datasources.
// It caches results per datasource UID and runs background cleanup
// to remove expired entries.
// Providers are registered via RegisterProvider and looked up by datasource type.
// Implements app.Runnable via Run() to manage the cleanup goroutine lifecycle.
type MetricsCache struct {
	entries   sync.Map                   // key: datasourceUID → *cacheEntry
	providers map[string]MetricsProvider // key: datasource type (e.g., "prometheus"), read-only after init
	sf        singleflight.Group         // coalesces concurrent fetches for the same datasourceUID
}

// NewMetricsCache creates a new MetricsCache.
// Use RegisterProvider to add providers for each datasource type.
func NewMetricsCache() *MetricsCache {
	return &MetricsCache{
		providers: make(map[string]MetricsProvider),
	}
}

// RegisterProvider registers a MetricsProvider for a datasource type.
// This should be called during app initialization, before any GetMetrics calls.
// Panics if a provider is already registered for the given type.
func (c *MetricsCache) RegisterProvider(dsType string, provider MetricsProvider) {
	if _, exists := c.providers[dsType]; exists {
		panic("provider already registered for datasource type: " + dsType)
	}
	c.providers[dsType] = provider
}

// Run implements app.Runnable. It runs the cleanup loop until the context is cancelled.
// This method blocks until the context is cancelled (when the app shuts down).
func (c *MetricsCache) Run(ctx context.Context) error {
	ticker := time.NewTicker(defaultCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			c.cleanupExpired()
		}
	}
}

// GetMetrics fetches metrics from cache or delegates to the appropriate provider.
// The provider is looked up from the registered providers by datasource type.
// On cache hit (non-expired entry), returns cached metrics immediately.
// On cache miss or expiration, fetches from provider and caches the result.
func (c *MetricsCache) GetMetrics(ctx context.Context, dsType, datasourceUID, datasourceURL string,
	client *http.Client) ([]string, error) {
	// Check cache first
	if val, ok := c.entries.Load(datasourceUID); ok {
		cached := toEntry(val)
		if time.Now().Before(cached.expiresAt) {
			return cached.metrics, nil
		}
	}

	// Verify provider exists
	provider := c.providers[dsType]
	if provider == nil {
		return nil, fmt.Errorf("no metrics provider registered for datasource type: %s", dsType)
	}

	// Cache miss or expired — use singleflight to coalesce concurrent fetches
	v, err, _ := c.sf.Do(datasourceUID, func() (any, error) {
		// Re-check cache: another goroutine may have populated it while we waited
		if val, ok := c.entries.Load(datasourceUID); ok {
			cached := toEntry(val)
			if time.Now().Before(cached.expiresAt) {
				return cached.metrics, nil
			}
		}

		result, err := provider.GetMetrics(ctx, datasourceUID, datasourceURL, client)
		if err != nil {
			return nil, err
		}

		// Don't cache results with zero TTL
		if result.TTL > 0 {
			c.entries.Store(datasourceUID, &cacheEntry{
				metrics:    result.Metrics,
				metricsSet: toMetricsSet(result.Metrics),
				expiresAt:  time.Now().Add(result.TTL),
			})
		}

		return result.Metrics, nil
	})
	if err != nil {
		return nil, err
	}

	return v.([]string), nil
}

// GetMetricsSet returns the cached metrics as a set (map[string]bool) for O(1) lookup.
// This avoids rebuilding the set from []string on every call — critical when the
// metrics list is large (100K+ entries, ~28MB per map rebuild).
//
// NOTE: This method delegates to GetMetrics for fetching/caching logic.
// If GetMetrics' caching behavior changes, this method must be updated in lockstep.
func (c *MetricsCache) GetMetricsSet(ctx context.Context, dsType, datasourceUID, datasourceURL string,
	client *http.Client) (map[string]bool, error) {
	// Check cache — return the pre-built set on hit
	if val, ok := c.entries.Load(datasourceUID); ok {
		cached := toEntry(val)
		if time.Now().Before(cached.expiresAt) {
			return cached.metricsSet, nil
		}
	}

	// Delegate to GetMetrics to handle provider lookup, fetching, and caching
	metrics, err := c.GetMetrics(ctx, dsType, datasourceUID, datasourceURL, client)
	if err != nil {
		return nil, err
	}

	// Re-check cache — GetMetrics will have stored the entry (with metricsSet) if TTL > 0
	if val, ok := c.entries.Load(datasourceUID); ok {
		cached := toEntry(val)
		if time.Now().Before(cached.expiresAt) {
			return cached.metricsSet, nil
		}
	}

	// Fallback: provider returned TTL=0 (explicitly opted out of caching), build set on the fly
	return toMetricsSet(metrics), nil
}

// toMetricsSet converts a slice of metric names to a set for O(1) lookup.
func toMetricsSet(metrics []string) map[string]bool {
	set := make(map[string]bool, len(metrics))
	for _, m := range metrics {
		set[m] = true
	}
	return set
}

// cleanupExpired removes expired entries from the cache.
func (c *MetricsCache) cleanupExpired() {
	now := time.Now()

	c.entries.Range(func(key, val any) bool {
		if now.After(toEntry(val).expiresAt) {
			c.entries.Delete(key)
		}
		return true
	})
}
