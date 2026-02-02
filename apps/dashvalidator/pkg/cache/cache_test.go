package cache

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// mockProvider implements MetricsProvider for testing
type mockProvider struct {
	mu        sync.Mutex
	callCount int
	metrics   []string
	ttl       time.Duration
	err       error
}

func (m *mockProvider) GetMetrics(ctx context.Context, datasourceUID, datasourceURL string,
	client *http.Client) (*MetricsResult, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.callCount++
	if m.err != nil {
		return nil, m.err
	}
	return &MetricsResult{
		Metrics: m.metrics,
		TTL:     m.ttl,
	}, nil
}

func (m *mockProvider) getCallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.callCount
}

// setupTest creates a new MetricsCache and registers a mock provider for "test" type
func setupTest(mockProv *mockProvider) *MetricsCache {
	cache := NewMetricsCache()
	cache.RegisterProvider("test", mockProv)
	return cache
}

// ============================================================================
// Category 1: Cache Hit/Miss Behavior
// ============================================================================

func TestMetricsCache_CacheMiss_FetchesFromProvider(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a", "metric_b"},
		ttl:     5 * time.Minute,
	}
	cache := setupTest(mockProv)

	metrics, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)

	require.NoError(t, err)
	require.ElementsMatch(t, []string{"metric_a", "metric_b"}, metrics)
	require.Equal(t, 1, mockProv.getCallCount())
}

func TestMetricsCache_CacheHit_DoesNotFetchAgain(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a", "metric_b"},
		ttl:     5 * time.Minute,
	}
	cache := setupTest(mockProv)

	// First call - cache miss
	metrics1, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Second call - cache hit
	metrics2, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.ElementsMatch(t, metrics1, metrics2)
	require.Equal(t, 1, mockProv.getCallCount()) // Still 1, no new call
}

func TestMetricsCache_DifferentDatasources_SeparateCacheEntries(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     5 * time.Minute,
	}
	cache := setupTest(mockProv)

	// First datasource
	_, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom1:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Second datasource - separate cache entry
	_, err = cache.GetMetrics(context.Background(), "test", "ds-uid-2", "http://prom2:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 2, mockProv.getCallCount())

	// First datasource again - cache hit
	_, err = cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom1:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 2, mockProv.getCallCount()) // Still 2
}

// ============================================================================
// Category 2: TTL Expiration
// ============================================================================

func TestMetricsCache_ExpiredEntry_FetchesAgain(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     10 * time.Millisecond, // Very short TTL
	}
	cache := setupTest(mockProv)

	// First call
	_, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Wait for TTL to expire
	time.Sleep(20 * time.Millisecond)

	// Second call after expiration
	_, err = cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 2, mockProv.getCallCount()) // New call made
}

func TestMetricsCache_ZeroTTL_DoesNotCache(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     0, // Zero TTL - don't cache
	}
	cache := setupTest(mockProv)

	// First call
	_, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Second call - should fetch again since zero TTL means no caching
	_, err = cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 2, mockProv.getCallCount())
}

// ============================================================================
// Category 3: Error Handling
// ============================================================================

func TestMetricsCache_ProviderError_ReturnsError(t *testing.T) {
	providerErr := errors.New("connection refused")
	mockProv := &mockProvider{
		err: providerErr,
	}
	cache := setupTest(mockProv)

	metrics, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)

	require.Error(t, err)
	require.ErrorIs(t, err, providerErr)
	require.Nil(t, metrics)
	require.Equal(t, 1, mockProv.getCallCount())
}

func TestMetricsCache_ProviderError_DoesNotCache(t *testing.T) {
	providerErr := errors.New("connection refused")
	mockProv := &mockProvider{
		err: providerErr,
	}
	cache := setupTest(mockProv)

	// First call - error
	_, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.Error(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Clear error for next call
	mockProv.mu.Lock()
	mockProv.err = nil
	mockProv.metrics = []string{"metric_a"}
	mockProv.ttl = 5 * time.Minute
	mockProv.mu.Unlock()

	// Second call - should fetch again (error not cached)
	metrics, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.NotNil(t, metrics)
	require.Equal(t, 2, mockProv.getCallCount())
}

// ============================================================================
// Category 4: Concurrent Access
// ============================================================================

func TestMetricsCache_ConcurrentAccess_ThreadSafe(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a", "metric_b"},
		ttl:     5 * time.Minute,
	}
	cache := setupTest(mockProv)

	// Run concurrent requests
	var wg sync.WaitGroup
	errCount := atomic.Int32{}

	for i := range 100 {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			// Alternate between datasources to test cache isolation
			uid := "ds-uid-1"
			if idx%2 == 0 {
				uid = "ds-uid-2"
			}
			metrics, err := cache.GetMetrics(context.Background(), "test", uid, "http://prom:9090", nil)
			if err != nil {
				errCount.Add(1)
				return
			}
			if len(metrics) != 2 {
				errCount.Add(1)
			}
		}(i)
	}

	wg.Wait()
	require.Equal(t, int32(0), errCount.Load())
	// Without request coalescing (singleflight), multiple goroutines may see a cache miss
	// before any result is cached. We verify the cache eventually works (low call count)
	// rather than exactly 2 calls. With 100 requests for 2 UIDs, we expect at most a few
	// calls per UID during the initial thundering herd.
	callCount := mockProv.getCallCount()
	require.GreaterOrEqual(t, callCount, 2, "should have at least 2 calls (one per UID)")
	require.LessOrEqual(t, callCount, 10, "should have at most 10 calls (cache should help)")
}

// ============================================================================
// Category 5: Cleanup Behavior
// ============================================================================

func TestMetricsCache_CleanupRemovesExpiredEntries(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     10 * time.Millisecond, // Very short TTL
	}
	cache := setupTest(mockProv)

	// Populate cache
	_, err := cache.GetMetrics(context.Background(), "test", "ds-uid-1", "http://prom:9090", nil)
	require.NoError(t, err)
	require.Equal(t, 1, mockProv.getCallCount())

	// Verify entry exists
	cache.mu.RLock()
	_, exists := cache.entries["ds-uid-1"]
	cache.mu.RUnlock()
	require.True(t, exists)

	// Wait for TTL to expire
	time.Sleep(20 * time.Millisecond)

	// Trigger cleanup
	cache.cleanupExpired()

	// Verify entry was removed
	cache.mu.RLock()
	_, exists = cache.entries["ds-uid-1"]
	cache.mu.RUnlock()
	require.False(t, exists)
}

func TestMetricsCache_RunStopsOnContextCancel(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     5 * time.Minute,
	}
	cache := setupTest(mockProv)

	ctx, cancel := context.WithCancel(context.Background())

	// Run in goroutine
	done := make(chan error)
	go func() {
		done <- cache.Run(ctx)
	}()

	// Cancel context
	cancel()

	// Verify Run() exits
	select {
	case err := <-done:
		require.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("Run() did not exit after context cancellation")
	}
}

// ============================================================================
// Category 6: Provider Registration Behavior
// ============================================================================

func TestMetricsCache_RegisterProvider_DuplicateType_Panics(t *testing.T) {
	mockProv := &mockProvider{
		metrics: []string{"metric_a"},
		ttl:     5 * time.Minute,
	}
	cache := NewMetricsCache()

	// First registration succeeds
	cache.RegisterProvider("duplicate", mockProv)

	// Second registration panics
	require.Panics(t, func() {
		cache.RegisterProvider("duplicate", mockProv)
	})
}
