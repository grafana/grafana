package legacypermissions

import (
	"context"
	"errors"
	"testing"
	"time"

	authcache "github.com/grafana/authlib/cache"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/user"
)

type fakeAuthCache struct {
	data             map[string][]byte
	expiry           map[string]time.Duration
	getErr, setErr   error
	deleteErr        error
	gets, sets, dels int
}

func newFakeAuthCache() *fakeAuthCache {
	return &fakeAuthCache{data: map[string][]byte{}, expiry: map[string]time.Duration{}}
}

func (c *fakeAuthCache) Get(_ context.Context, key string) ([]byte, error) {
	c.gets++
	if c.getErr != nil {
		return nil, c.getErr
	}
	data, ok := c.data[key]
	if !ok {
		return nil, authcache.ErrNotFound
	}
	return data, nil
}

func (c *fakeAuthCache) Set(_ context.Context, key string, data []byte, expire time.Duration) error {
	c.sets++
	if c.setErr != nil {
		return c.setErr
	}
	c.data[key], c.expiry[key] = data, expire
	return nil
}

func (c *fakeAuthCache) Delete(_ context.Context, key string) error {
	c.dels++
	if c.deleteErr != nil {
		return c.deleteErr
	}
	delete(c.data, key)
	return nil
}

func TestSharedPermissionCache(t *testing.T) {
	ctx := context.Background()
	backing := newFakeAuthCache()
	cache := newSharedPermissionCache(backing)

	_, ok, err := cache.get(ctx, "missing")
	require.NoError(t, err)
	require.False(t, ok)

	// Only action and scope are stored; an empty scope and an empty result survive.
	stored := []ac.Permission{{Action: "users:read", Scope: "users:*", Kind: "users"}, {Action: "users:create"}}
	require.NoError(t, cache.set(ctx, "key", stored, 30*time.Second))
	got, ok, err := cache.get(ctx, "key")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, []ac.Permission{{Action: "users:read", Scope: "users:*"}, {Action: "users:create"}}, got)
	require.NoError(t, cache.set(ctx, "empty", []ac.Permission{}, 30*time.Second))
	got, ok, err = cache.get(ctx, "empty")
	require.NoError(t, err)
	require.True(t, ok)
	require.NotNil(t, got)
	require.Empty(t, got)

	for ttl, want := range map[time.Duration]time.Duration{
		500 * time.Millisecond:  time.Second,
		time.Second:             time.Second,
		1500 * time.Millisecond: 2 * time.Second,
		30 * time.Second:        30 * time.Second,
	} {
		require.NoError(t, cache.set(ctx, "ttl", nil, ttl))
		require.Equal(t, want, backing.expiry["ttl"], ttl)
	}

	backing.data["corrupt"] = []byte("not json")
	_, _, err = cache.get(ctx, "corrupt")
	require.ErrorContains(t, err, `decode permission cache key "corrupt"`)

	require.NoError(t, cache.delete(ctx, "key"))
	_, ok, err = cache.get(ctx, "key")
	require.NoError(t, err)
	require.False(t, ok)

	failure := errors.New("memcached unavailable")
	backing.getErr, backing.setErr, backing.deleteErr = failure, failure, failure
	_, _, err = cache.get(ctx, "key")
	require.ErrorIs(t, err, failure)
	require.ErrorIs(t, cache.set(ctx, "key", stored, time.Second), failure)
	require.ErrorIs(t, cache.delete(ctx, "key"), failure)
}

func TestPermissionCacheFailuresAreMisses(t *testing.T) {
	failure := errors.New("memcached unavailable")
	for _, tc := range []struct {
		name      string
		configure func(*fakeAuthCache)
		operation string
	}{
		{name: "read", configure: func(c *fakeAuthCache) { c.getErr = failure }, operation: "read"},
		{name: "write", configure: func(c *fakeAuthCache) { c.setErr = failure }, operation: "write"},
		{name: "decode", configure: func(c *fakeAuthCache) { c.data[`legacy-remote:"stacks-1":key`] = []byte("not json") }, operation: "read"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			recorder := recordPermissionSpans(t)
			backing := newFakeAuthCache()
			tc.configure(backing)
			loader := &Loader{cache: newSharedPermissionCache(backing)}
			WithPermissionCacheTTL(time.Minute)(loader)
			ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-1")
			fresh := []ac.Permission{{Action: "users:read"}}
			got, err := loader.cached(ctx, "direct", "key", ac.Options{}, func(context.Context) ([]ac.Permission, error) { return fresh, nil })
			require.NoError(t, err)
			require.Equal(t, fresh, got)
			span := permissionSpan(t, recorder, "cache")
			require.Equal(t, attribute.StringValue(tc.operation), spanAttributes(span)["cache.error"])
			require.Equal(t, attribute.BoolValue(true), spanAttributes(span)["cache.load_executed"])
			require.NotEqual(t, codes.Error, span.Status().Code)
			require.NotEmpty(t, span.Events())
			require.Equal(t, "exception", span.Events()[0].Name)
		})
	}
}

func TestClearUserPermissionCacheIsTenantScoped(t *testing.T) {
	for name, cache := range map[string]permissionCache{
		"local":  localPermissionCache{cache: localcache.New(time.Hour, 0)},
		"shared": newSharedPermissionCache(authcache.NewLocalCache(authcache.Config{})),
	} {
		t.Run(name, func(t *testing.T) {
			loader := &Loader{cache: cache}
			requester := &user.SignedInUser{UserID: 7, OrgID: 1}
			tenant := func(ns string) context.Context {
				return context.WithValue(context.Background(), remoteNamespaceKey{}, ns)
			}
			keys := []string{ac.GetUserDirectPermissionCacheKey(requester), ac.GetZanzanaUserPermissionCacheKey(requester)}
			for _, ns := range []string{"stacks-1", "stacks-2"} {
				for _, key := range keys {
					require.NoError(t, cache.set(tenant(ns), tenantCacheKey(tenant(ns), key), []ac.Permission{{Action: ns}}, time.Hour))
				}
			}
			require.NoError(t, loader.ClearUserPermissionCache(tenant("stacks-1"), requester))
			for _, key := range keys {
				_, ok, err := cache.get(tenant("stacks-1"), tenantCacheKey(tenant("stacks-1"), key))
				require.NoError(t, err)
				require.False(t, ok, key)
				got, ok, err := cache.get(tenant("stacks-2"), tenantCacheKey(tenant("stacks-2"), key))
				require.NoError(t, err)
				require.True(t, ok, key)
				require.Equal(t, "stacks-2", got[0].Action)
			}
		})
	}
}
