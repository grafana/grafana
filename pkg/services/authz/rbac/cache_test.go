package rbac

import (
	"context"
	"strings"
	"testing"
	"time"

	libcache "github.com/grafana/authlib/cache"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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

func TestPermCacheActionPart(t *testing.T) {
	setsA := []string{"dashboards:view", "folders:view"}
	setsB := []string{"dashboards:view", "folders:edit"}

	t.Run("no action sets stays distinct from the legacy bare-action format", func(t *testing.T) {
		assert.NotEqual(t, "dashboards:read", permCacheActionPart("dashboards:read", nil))
	})

	t.Run("with and without action sets do not collide", func(t *testing.T) {
		assert.NotEqual(t,
			permCacheActionPart("dashboards:read", nil),
			permCacheActionPart("dashboards:read", setsA))
	})

	t.Run("different action sets do not collide", func(t *testing.T) {
		assert.NotEqual(t,
			permCacheActionPart("dashboards:read", setsA),
			permCacheActionPart("dashboards:read", setsB))
	})

	t.Run("set order does not matter", func(t *testing.T) {
		assert.Equal(t,
			permCacheActionPart("dashboards:read", []string{"a:view", "b:view"}),
			permCacheActionPart("dashboards:read", []string{"b:view", "a:view"}))
	})
}

// TestPermCacheKeyLength guards the memcached key limit: keys longer than 250
// bytes are rejected (ErrMalformedKey), which would turn every check for the
// affected action into a permanent cache miss.
func TestPermCacheKeyLength(t *testing.T) {
	const memcachedMaxKeyLen = 250
	longNamespace := strings.Repeat("n", 40)
	longUID := strings.Repeat("u", 40)

	verbs := []string{
		utils.VerbGet, utils.VerbList, utils.VerbWatch, utils.VerbCreate,
		utils.VerbUpdate, utils.VerbPatch, utils.VerbDelete,
		utils.VerbDeleteCollection, utils.VerbGetPermissions, utils.VerbSetPermissions,
	}

	reg := NewMapperRegistry()
	for _, group := range reg.GetGroups() {
		for _, m := range reg.GetAll(group) {
			for _, verb := range verbs {
				action, ok := m.Action(verb)
				if !ok {
					continue
				}
				key := userPermCacheKey(longNamespace, longUID, action, m.ActionSets(verb))
				assert.LessOrEqual(t, len(key), memcachedMaxKeyLen,
					"cache key for %s/%s verb %s exceeds the memcached limit: %s", group, m.Resource(), verb, key)
			}
		}
	}
}
