package rbac

import (
	"context"
	"testing"
	"time"

	libcache "github.com/grafana/authlib/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func newTestCache() libcache.Cache {
	return libcache.NewLocalCache(libcache.Config{Expiry: 5 * time.Minute, CleanupInterval: 5 * time.Minute})
}

func TestCacheWrap_LocalTTL(t *testing.T) {
	remote := newTestCache()
	c := newCacheWrap[string](remote, log.NewNopLogger(), tracing.NewNoopTracerService(), 30*time.Second, 50*time.Millisecond)
	ctx := context.Background()

	v, ok := c.Get(ctx, "key")
	assert.False(t, ok)
	assert.Equal(t, "", v)

	c.Set(ctx, "key", "value1")

	v, ok = c.Get(ctx, "key")
	require.True(t, ok)
	assert.Equal(t, "value1", v)

	// Overwrite remote directly — local should still serve stale value until TTL expires
	require.NoError(t, remote.Set(ctx, "key", []byte(`"value2"`), 5*time.Minute))

	v, ok = c.Get(ctx, "key")
	require.True(t, ok)
	assert.Equal(t, "value1", v, "should still return locally cached value")

	// After local TTL expires, should pick up the new remote value
	time.Sleep(60 * time.Millisecond)

	v, ok = c.Get(ctx, "key")
	require.True(t, ok)
	assert.Equal(t, "value2", v, "should return updated remote value after local expiry")
}

func TestCacheWrap_NoLocalTTL(t *testing.T) {
	remote := newTestCache()
	c := newCacheWrap[string](remote, log.NewNopLogger(), tracing.NewNoopTracerService(), 30*time.Second)
	ctx := context.Background()

	c.Set(ctx, "key", "value1")

	// Overwrite remote directly — should be visible immediately without local layer
	require.NoError(t, remote.Set(ctx, "key", []byte(`"value2"`), 5*time.Minute))

	v, ok := c.Get(ctx, "key")
	require.True(t, ok)
	assert.Equal(t, "value2", v, "without local TTL changes should be visible immediately")
}
