package meta

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	pluginsv0alpha1 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/apps/plugins/pkg/app/metrics"
)

const (
	defaultCleanupInterval = 10 * time.Minute
)

// cachedMeta represents a cached metadata entry with expiration time
type cachedMeta struct {
	meta      pluginsv0alpha1.MetaSpec
	ttl       time.Duration
	expiresAt time.Time
}

// ProviderManager searches multiple providers for Plugin Meta in order until one succeeds, and caches
// results with per-provider TTLs.
// It implements app.Runnable to manage the cleanup goroutine lifecycle.
type ProviderManager struct {
	providers []Provider
	cache     map[string]*cachedMeta
	cacheMu   sync.RWMutex
}

// NewProviderManager creates a new ProviderManager that chains the given providers
// and caches results with per-provider TTLs.
func NewProviderManager(providers ...Provider) *ProviderManager {
	if len(providers) == 0 {
		panic("ProviderManager requires at least one provider")
	}

	return &ProviderManager{
		providers: providers,
		cache:     make(map[string]*cachedMeta),
	}
}

// Run implements app.Runnable. It runs the cleanup loop until the context is cancelled.
// This method blocks until the context is cancelled (when the app shuts down).
func (pm *ProviderManager) Run(ctx context.Context) error {
	ticker := time.NewTicker(defaultCleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			pm.cleanupExpired()
		}
	}
}

// GetMeta tries each provider in order until one succeeds, using cache when available.
// Returns ErrMetaNotFound only if all providers return ErrMetaNotFound.
// Otherwise, returns the last non-ErrMetaNotFound error if all providers fail.
func (pm *ProviderManager) GetMeta(ctx context.Context, ref PluginRef) (*Result, error) {
	metrics.MetaRequestsTotal.WithLabelValues(ref.ID, ref.Version).Inc()

	cacheKey := pm.cacheKey(ref)

	// Check cache first
	pm.cacheMu.RLock()
	cached, exists := pm.cache[cacheKey]
	pm.cacheMu.RUnlock()

	if exists && time.Now().Before(cached.expiresAt) {
		metrics.MetaCacheLookupTotal.WithLabelValues("hit").Inc()
		return &Result{
			Meta: cached.meta,
			TTL:  cached.ttl,
		}, nil
	}

	metrics.MetaCacheLookupTotal.WithLabelValues("miss").Inc()

	// Try each provider in order until one succeeds
	var lastErr error
	for _, provider := range pm.providers {
		start := time.Now()
		result, err := provider.GetMeta(ctx, ref)
		duration := time.Since(start)

		if err == nil {
			metrics.MetaFetchDurationSeconds.WithLabelValues(provider.Name(), "success").Observe(duration.Seconds())

			// Don't cache results with a zero TTL
			if result.TTL == 0 {
				return result, nil
			}

			pm.cacheMu.Lock()
			pm.cache[cacheKey] = &cachedMeta{
				meta:      result.Meta,
				ttl:       result.TTL,
				expiresAt: time.Now().Add(result.TTL),
			}
			metrics.MetaCacheSize.Set(float64(len(pm.cache)))
			pm.cacheMu.Unlock()

			return result, nil
		}

		// If not found, try next provider
		if errors.Is(err, ErrMetaNotFound) {
			metrics.MetaFetchDurationSeconds.WithLabelValues(provider.Name(), "not_found").Observe(duration.Seconds())
			continue
		}

		metrics.MetaFetchDurationSeconds.WithLabelValues(provider.Name(), "error").Observe(duration.Seconds())
		lastErr = err
	}

	if lastErr != nil {
		return nil, fmt.Errorf("failed to fetch plugin metadata from any provider: %w", lastErr)
	}

	return nil, ErrMetaNotFound
}

// cleanupExpired removes expired entries from the cache.
func (pm *ProviderManager) cleanupExpired() {
	now := time.Now()

	pm.cacheMu.Lock()
	defer pm.cacheMu.Unlock()

	evicted := 0
	for key, entry := range pm.cache {
		if now.After(entry.expiresAt) {
			delete(pm.cache, key)
			evicted++
		}
	}

	if evicted > 0 {
		metrics.MetaCacheEvictionsTotal.Add(float64(evicted))
		metrics.MetaCacheSize.Set(float64(len(pm.cache)))
	}
}

func (pm *ProviderManager) cacheKey(ref PluginRef) string {
	if ref.HasParent() {
		return fmt.Sprintf("%s:%s:%s", ref.ID, ref.Version, ref.GetParentID())
	}
	return fmt.Sprintf("%s:%s", ref.ID, ref.Version)
}
