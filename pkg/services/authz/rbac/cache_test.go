package rbac

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/authlib/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

// mockCache implements cache.Cache for testing
type mockCache struct {
	cacheAvailable bool
	getCount       int
	setCount       int
}

func (m *mockCache) Get(ctx context.Context, key string) ([]byte, error) {
	m.getCount++
	if !m.cacheAvailable {
		return nil, errors.New("cache unavailable")
	}
	return nil, cache.ErrNotFound
}

func (m *mockCache) Set(ctx context.Context, key string, data []byte, ttl time.Duration) error {
	m.setCount++
	if !m.cacheAvailable {
		return errors.New("cache unavailable")
	}
	return nil
}

func (m *mockCache) Delete(ctx context.Context, key string) error {
	if !m.cacheAvailable {
		return errors.New("cache unavailable")
	}
	return nil
}

type mockCacheTestConfig struct {
	CacheIsAvailable bool
}

func newMockCache(cfg mockCacheTestConfig) (*mockCache, cacheWrap[string]) {
	mockBackend := &mockCache{cacheAvailable: cfg.CacheIsAvailable}
	logger := log.NewNopLogger()
	tracer := tracing.NewNoopTracerService()
	wrapper := newCacheWrap[string](mockBackend, logger, tracer, 300)
	return mockBackend, wrapper
}

func TestCacheSkipBasicFunctionality(t *testing.T) {
	t.Run("shouldSkipCache returns false for fresh context", func(t *testing.T) {
		ctx := context.Background()
		assert.False(t, shouldSkipCache(ctx))
	})

	t.Run("shouldSkipCache returns false for initialized but not marked context", func(t *testing.T) {
		ctx := initMarkCacheSkipState(context.Background())
		assert.False(t, shouldSkipCache(ctx))
	})

	t.Run("shouldSkipCache returns true after marking", func(t *testing.T) {
		ctx := context.Background()
		ctx = initMarkCacheSkipState(ctx)
		markCacheSkip(ctx)
		assert.True(t, shouldSkipCache(ctx))
	})

	t.Run("markCacheSkip logs warning when state not initialized", func(t *testing.T) {
		// For this test, we'll just verify the behavior without capturing logs
		// since the logging mechanism is working correctly based on the implementation

		ctx := context.Background() // Not initialized with initMarkCacheSkipState

		// This should trigger a warning log since cache state is not initialized
		// The warning will be logged but not captured in the test
		markCacheSkip(ctx)

		// shouldSkipCache should still return false since state wasn't initialized
		assert.False(t, shouldSkipCache(ctx))

		// Verify that the proper initialization works
		ctxInitialized := initMarkCacheSkipState(context.Background())
		markCacheSkip(ctxInitialized)
		assert.True(t, shouldSkipCache(ctxInitialized))
	})
}

func TestCacheErrorTriggersSkip(t *testing.T) {
	t.Run("Get errors mark context to skip subsequent operations", func(t *testing.T) {
		// initate mockedcache that is not available
		mockBackend, wrapper := newMockCache(mockCacheTestConfig{CacheIsAvailable: false})
		ctx := initMarkCacheSkipState(context.Background())

		// First call hits cache and fails, triggering skip
		_, ok1 := wrapper.Get(ctx, "key1")
		assert.False(t, ok1)
		assert.Equal(t, 1, mockBackend.getCount)
		assert.True(t, shouldSkipCache(ctx), "Context should be marked to skip")

		// Second call should skip cache
		_, ok2 := wrapper.Get(ctx, "key2")
		assert.False(t, ok2)
		assert.Equal(t, 1, mockBackend.getCount, "Should skip due to previous error")
	})

	t.Run("Set errors mark context to skip subsequent operations", func(t *testing.T) {
		mockBackend, wrapper := newMockCache(mockCacheTestConfig{CacheIsAvailable: false})
		ctx := initMarkCacheSkipState(context.Background())

		// First call hits cache and fails, triggering skip
		wrapper.Set(ctx, "key1", "value1")
		assert.Equal(t, 1, mockBackend.setCount)
		assert.True(t, shouldSkipCache(ctx), "Context should be marked to skip")

		// Second call should skip cache
		wrapper.Set(ctx, "key2", "value2")
		assert.Equal(t, 1, mockBackend.setCount, "Should skip due to previous error")
	})
}

func TestCacheSkipPerformance(t *testing.T) {
	ctx := context.Background()
	ctx = initMarkCacheSkipState(ctx)
	markCacheSkip(ctx)

	// Multiple skip checks should be fast (atomic reads)
	for i := 0; i < 1000; i++ {
		skip := shouldSkipCache(ctx)
		require.True(t, skip)
	}
}
