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
	shouldFail bool
	getCount   int
	setCount   int
}

func (m *mockCache) Get(ctx context.Context, key string) ([]byte, error) {
	m.getCount++
	if m.shouldFail {
		return nil, errors.New("cache unavailable")
	}
	return nil, cache.ErrNotFound
}

func (m *mockCache) Set(ctx context.Context, key string, data []byte, ttl time.Duration) error {
	m.setCount++
	if m.shouldFail {
		return errors.New("cache unavailable")
	}
	return nil
}

func (m *mockCache) Delete(ctx context.Context, key string) error {
	if m.shouldFail {
		return errors.New("cache unavailable")
	}
	return nil
}

func TestCacheCircuitBreaker(t *testing.T) {
	mockBackend := &mockCache{shouldFail: true}
	logger := log.NewNopLogger()
	tracer := tracing.NewNoopTracerService()

	// Create cache wrapper that will encounter errors
	wrapper := newCacheWrap[string](mockBackend, logger, tracer, 300)

	ctx := context.Background()

	// First Get call should attempt cache
	_, ok1 := wrapper.Get(ctx, "key1")
	assert.False(t, ok1)
	assert.Equal(t, 1, mockBackend.getCount, "First call should hit cache")

	// Manually test the circuit breaker functionality
	markCacheSkip(ctx)
	assert.True(t, shouldSkipCache(ctx), "Context should be marked to skip cache")

	// Second Get call should skip cache entirely due to marked context
	_, ok2 := wrapper.Get(ctx, "key2")
	assert.False(t, ok2)
	assert.Equal(t, 1, mockBackend.getCount, "Second call should skip cache due to circuit breaker")

	// Set call should also skip cache
	wrapper.Set(ctx, "key3", "value")
	assert.Equal(t, 0, mockBackend.setCount, "Set call should skip cache due to circuit breaker")
}

func TestCacheCircuitBreakerIntegration(t *testing.T) {
	// Test that demonstrates how circuit breaker would work in practice
	// where error handling is done at a higher level

	mockBackend := &mockCache{shouldFail: false}
	logger := log.NewNopLogger()
	tracer := tracing.NewNoopTracerService()

	wrapper := newCacheWrap[string](mockBackend, logger, tracer, 300)

	// Simulate service-level circuit breaker logic
	ctx := context.Background()

	// First operation succeeds
	_, ok := wrapper.Get(ctx, "key1")
	assert.False(t, ok) // Cache miss, but no error
	assert.Equal(t, 1, mockBackend.getCount)

	// Simulate cache becoming unavailable
	mockBackend.shouldFail = true

	// Service detects cache error and marks context
	_, ok = wrapper.Get(ctx, "key2")
	assert.False(t, ok)
	assert.Equal(t, 2, mockBackend.getCount)

	// Service would detect the error and mark context for subsequent operations
	markCacheSkip(ctx)

	// Subsequent operations skip cache
	_, ok = wrapper.Get(ctx, "key3")
	assert.False(t, ok)
	assert.Equal(t, 2, mockBackend.getCount, "Should skip due to circuit breaker")
}

func TestCacheCircuitBreakerRequestIsolation(t *testing.T) {
	mockBackend := &mockCache{shouldFail: false}
	logger := log.NewNopLogger()
	tracer := tracing.NewNoopTracerService()

	wrapper := newCacheWrap[string](mockBackend, logger, tracer, 300)

	// First request context with circuit breaker active
	ctx := context.Background()
	markCacheSkip(ctx)
	assert.True(t, shouldSkipCache(ctx), "First context should have circuit breaker active")

	// Cache operation should be skipped
	_, ok := wrapper.Get(ctx, "key1")
	assert.False(t, ok)
	assert.Equal(t, 0, mockBackend.getCount, "Should skip cache due to circuit breaker")

	// Second request context - fresh start (no circuit breaker)
	ctx2 := context.Background()
	assert.False(t, shouldSkipCache(ctx2), "Fresh context should not have circuit breaker active")

	// Cache operation should proceed normally
	_, ok2 := wrapper.Get(ctx2, "key2")
	assert.False(t, ok2) // Cache miss, but attempt was made
	assert.Equal(t, 1, mockBackend.getCount, "Fresh request should allow cache operations")
}

func TestCachePerformance(t *testing.T) {
	// Simulate context with cache skip marker
	ctx := context.Background()
	markCacheSkip(ctx)

	// Multiple skip checks should be fast (atomic reads)
	for i := 0; i < 1000; i++ {
		skip := shouldSkipCache(ctx)
		require.True(t, skip)
	}
}
