package cache

import (
	"context"
	"fmt"
	"net/http"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

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
	mu        sync.RWMutex
	entries   map[string]*cacheEntry     // key: datasourceUID
	providers map[string]MetricsProvider // key: datasource type (e.g., "prometheus")
	sf        singleflight.Group         // coalesces concurrent fetches for the same datasourceUID
}

// NewMetricsCache creates a new MetricsCache.
// Use RegisterProvider to add providers for each datasource type.
func NewMetricsCache() *MetricsCache {
	return &MetricsCache{
		entries:   make(map[string]*cacheEntry),
		providers: make(map[string]MetricsProvider),
	}
}

// RegisterProvider registers a MetricsProvider for a datasource type.
// This should be called during app initialization, before any GetMetrics calls.
// Panics if a provider is already registered for the given type.
func (c *MetricsCache) RegisterProvider(dsType string, provider MetricsProvider) {
	c.mu.Lock()
	defer c.mu.Unlock()

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
	// Check cache first (read lock)
	c.mu.RLock()
	cached, exists := c.entries[datasourceUID]
	provider := c.providers[dsType]
	c.mu.RUnlock()

	if exists && time.Now().Before(cached.expiresAt) {
		return cached.metrics, nil
	}

	// Verify provider exists
	if provider == nil {
		return nil, fmt.Errorf("no metrics provider registered for datasource type: %s", dsType)
	}

	// Cache miss or expired — use singleflight to coalesce concurrent fetches
	v, err, _ := c.sf.Do(datasourceUID, func() (any, error) {
		// Re-check cache: another goroutine may have populated it while we waited
		c.mu.RLock()
		cached, exists := c.entries[datasourceUID]
		c.mu.RUnlock()
		if exists && time.Now().Before(cached.expiresAt) {
			return cached.metrics, nil
		}

		result, err := provider.GetMetrics(ctx, datasourceUID, datasourceURL, client)
		if err != nil {
			return nil, err
		}

		// Don't cache results with zero TTL
		if result.TTL > 0 {
			c.mu.Lock()
			c.entries[datasourceUID] = &cacheEntry{
				metrics:    result.Metrics,
				metricsSet: toMetricsSet(result.Metrics),
				expiresAt:  time.Now().Add(result.TTL),
			}
			c.mu.Unlock()
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
	c.mu.RLock()
	cached, exists := c.entries[datasourceUID]
	c.mu.RUnlock()

	if exists && time.Now().Before(cached.expiresAt) {
		return cached.metricsSet, nil
	}

	// Delegate to GetMetrics to handle provider lookup, fetching, and caching
	metrics, err := c.GetMetrics(ctx, dsType, datasourceUID, datasourceURL, client)
	if err != nil {
		return nil, err
	}

	// Re-check cache — GetMetrics will have stored the entry (with metricsSet) if TTL > 0
	c.mu.RLock()
	cached, exists = c.entries[datasourceUID]
	c.mu.RUnlock()

	if exists && time.Now().Before(cached.expiresAt) {
		return cached.metricsSet, nil
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

	c.mu.Lock()
	defer c.mu.Unlock()

	for key, entry := range c.entries {
		if now.After(entry.expiresAt) {
			delete(c.entries, key)
		}
	}
}
