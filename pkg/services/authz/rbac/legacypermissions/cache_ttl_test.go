package legacypermissions

import (
	"context"
	"testing"
	"testing/synctest"
	"time"

	authcache "github.com/grafana/authlib/cache"

	"github.com/grafana/grafana/pkg/infra/localcache"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

// Grant changes become visible after at most the TTL, with both cache stores.
func TestPermissionCacheTTL(t *testing.T) {
	stores := map[string]func() permissionCache{
		"local":  func() permissionCache { return localPermissionCache{cache: localcache.New(time.Hour, 0)} },
		"shared": func() permissionCache { return newSharedPermissionCache(authcache.NewLocalCache(authcache.Config{})) },
	}
	for _, source := range []string{"direct", "basic_role", "team", "zanzana"} {
		for store, newCache := range stores {
			t.Run(source+"/"+store, func(t *testing.T) { testPermissionCacheTTL(t, source, newCache) })
		}
	}
}

func testPermissionCacheTTL(t *testing.T, source string, newCache func() permissionCache) {
	synctest.Test(t, func(t *testing.T) {
		loader := &Loader{cache: newCache()}
		WithPermissionCacheTTL(time.Second)(loader)
		ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-1")
		calls := 0
		load := func(context.Context) ([]ac.Permission, error) { calls++; return []ac.Permission{{Action: source}}, nil }
		get := func(reload bool) {
			_, err := loader.cached(ctx, source, source, ac.Options{ReloadCache: reload}, load)
			require.NoError(t, err)
		}
		get(false)
		get(false)
		require.Equal(t, 1, calls)
		time.Sleep(500 * time.Millisecond)
		get(true)
		require.Equal(t, 2, calls)
		time.Sleep(750 * time.Millisecond)
		get(false)
		require.Equal(t, 2, calls)
		time.Sleep(500 * time.Millisecond)
		get(false)
		require.Equal(t, 3, calls)
	})
}

func TestPermissionCacheTTLDisabled(t *testing.T) {
	for _, source := range []string{"direct", "basic_role", "team", "zanzana"} {
		t.Run(source, func(t *testing.T) {
			loader := &Loader{cache: localPermissionCache{cache: localcache.New(time.Hour, 0)}}
			WithPermissionCacheTTL(0)(loader)
			ctx := context.WithValue(context.Background(), remoteNamespaceKey{}, "stacks-1")
			key := tenantCacheKey(ctx, source)
			localStore(loader).Set(key, []ac.Permission{{Action: "stale"}}, time.Hour)
			calls := 0
			load := func(context.Context) ([]ac.Permission, error) {
				calls++
				return []ac.Permission{{Action: "fresh"}}, nil
			}
			for _, reload := range []bool{false, true, false} {
				got, err := loader.cached(ctx, source, source, ac.Options{ReloadCache: reload}, load)
				require.NoError(t, err)
				require.Equal(t, "fresh", got[0].Action)
			}
			require.Equal(t, 3, calls)
			stored, ok := localStore(loader).Get(key)
			require.True(t, ok)
			require.Equal(t, "stale", stored.([]ac.Permission)[0].Action)
			localStore(loader).Delete(key)
			_, err := loader.cached(ctx, source, source, ac.Options{}, load)
			require.NoError(t, err)
			_, ok = localStore(loader).Get(key)
			require.False(t, ok)
		})
	}
}

func TestDefaultPermissionCacheTTL(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		loader := &Loader{cache: localPermissionCache{cache: localcache.New(time.Hour, 0)}}
		require.Equal(t, ac.PermissionCacheTTL, loader.permissionCacheTTL())
		calls := 0
		load := func(context.Context) ([]ac.Permission, error) { calls++; return nil, nil }
		get := func() {
			_, err := loader.cached(context.Background(), "direct", "key", ac.Options{}, load)
			require.NoError(t, err)
		}
		get()
		time.Sleep(ac.PermissionCacheTTL - time.Second)
		get()
		require.Equal(t, 1, calls)
		time.Sleep(2 * time.Second)
		get()
		require.Equal(t, 2, calls)
	})
}

func localStore(loader *Loader) *localcache.CacheService {
	return loader.cache.(localPermissionCache).cache
}
