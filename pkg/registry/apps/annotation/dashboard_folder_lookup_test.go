package annotation

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	dynamicfake "k8s.io/client-go/dynamic/fake"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
)

func newTestDashboardFolderResolver(cacheEnabled bool, objects ...runtime.Object) (*dashboardFolderResolver, *dynamicfake.FakeDynamicClient) {
	gvr := dashboardv1.DashboardResourceInfo.GroupVersionResource()
	scheme := runtime.NewScheme()
	listKinds := map[schema.GroupVersionResource]string{gvr: "DashboardList"}
	fakeDyn := dynamicfake.NewSimpleDynamicClientWithCustomListKinds(scheme, listKinds, objects...)

	const testCacheTTL = time.Minute
	r := &dashboardFolderResolver{
		client:       &dashboardClient{gvr: gvr, dyn: fakeDyn},
		tracer:       testTracer,
		metrics:      ProvideMetrics(prometheus.NewRegistry()),
		fetchTimeout: defaultFolderFetchTimeout,
	}
	if cacheEnabled {
		r.cache = localcache.New(testCacheTTL, time.Minute)
		r.cacheTTL = testCacheTTL
	}
	return r, fakeDyn
}

// gatedDashboardGetter blocks every Get until release is closed or the fetch context is done.
type gatedDashboardGetter struct {
	dash    *unstructured.Unstructured
	release chan struct{}
	hits    atomic.Int32
}

func newGatedDashboardGetter(dash *unstructured.Unstructured) *gatedDashboardGetter {
	return &gatedDashboardGetter{dash: dash, release: make(chan struct{})}
}

func (g *gatedDashboardGetter) Get(ctx context.Context, _, _ string) (*unstructured.Unstructured, error) {
	g.hits.Add(1)
	select {
	case <-g.release:
		return g.dash, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func newFakeDashboard(namespace, uid, folder string) *unstructured.Unstructured {
	dash := &unstructured.Unstructured{}
	dash.SetAPIVersion(dashboardv1.DashboardResourceInfo.GroupVersionKind().GroupVersion().String())
	dash.SetKind("Dashboard")
	dash.SetNamespace(namespace)
	dash.SetName(uid)
	if folder != "" {
		dash.SetAnnotations(map[string]string{"grafana.app/folder": folder})
	}
	return dash
}

func TestDashboardFolderResolver_ResolveFolder(t *testing.T) {
	const (
		ns        = "default"
		dashUID   = "dash-abc"
		folderUID = "folder-xyz"
	)
	ctx := identity.WithServiceIdentityContext(t.Context(), 1)

	countGets := func(fakeDyn *dynamicfake.FakeDynamicClient) int {
		count := 0
		for _, a := range fakeDyn.Actions() {
			if a.GetVerb() == "get" {
				count++
			}
		}
		return count
	}

	t.Run("resolves folder and caches result", func(t *testing.T) {
		resolver, fakeDyn := newTestDashboardFolderResolver(true, newFakeDashboard(ns, dashUID, folderUID))

		folder, err := resolver.ResolveFolder(ctx, ns, dashUID)
		require.NoError(t, err)
		assert.Equal(t, folderUID, folder)

		folder, err = resolver.ResolveFolder(ctx, ns, dashUID)
		require.NoError(t, err)
		assert.Equal(t, folderUID, folder)

		assert.Equal(t, 1, countGets(fakeDyn), "subsequent ResolveFolder calls should be served from cache, not the apiserver")
		assert.Equal(t, float64(1), testutil.ToFloat64(resolver.metrics.FolderCacheHits))
		assert.Equal(t, float64(1), testutil.ToFloat64(resolver.metrics.FolderCacheMisses))
	})

	t.Run("cache disabled resolves every call from the apiserver", func(t *testing.T) {
		resolver, fakeDyn := newTestDashboardFolderResolver(false, newFakeDashboard(ns, dashUID, folderUID))

		folder, err := resolver.ResolveFolder(ctx, ns, dashUID)
		require.NoError(t, err)
		assert.Equal(t, folderUID, folder)

		folder, err = resolver.ResolveFolder(ctx, ns, dashUID)
		require.NoError(t, err)
		assert.Equal(t, folderUID, folder)

		assert.Equal(t, 2, countGets(fakeDyn), "every call should hit the apiserver when caching is disabled")
	})

	t.Run("missing dashboard returns empty folder", func(t *testing.T) {
		resolver, _ := newTestDashboardFolderResolver(true)

		folder, err := resolver.ResolveFolder(ctx, ns, "missing-uid")
		require.NoError(t, err)
		assert.Equal(t, "", folder)
	})

	t.Run("concurrent calls for the same dashboard groups into one fetch", func(t *testing.T) {
		resolver, _ := newTestDashboardFolderResolver(true)
		synctest.Test(t, func(t *testing.T) {
			ctx := identity.WithServiceIdentityContext(t.Context(), 1)
			getter := newGatedDashboardGetter(newFakeDashboard(ns, dashUID, folderUID))
			resolver.client = getter

			const callers = 10
			var wg sync.WaitGroup
			results := make([]string, callers)
			errs := make([]error, callers)
			for i := range callers {
				wg.Go(func() {
					results[i], errs[i] = resolver.ResolveFolder(ctx, ns, dashUID)
				})
			}

			synctest.Wait()
			assert.Equal(t, int32(1), getter.hits.Load(), "concurrent lookups for the same dashboard should share a single apiserver fetch")

			close(getter.release)
			wg.Wait()
			for i := range callers {
				require.NoError(t, errs[i])
				assert.Equal(t, folderUID, results[i])
			}
		})
	})

	t.Run("cancelling one caller does not fail others sharing the fetch", func(t *testing.T) {
		resolver, _ := newTestDashboardFolderResolver(true)
		synctest.Test(t, func(t *testing.T) {
			ctx := identity.WithServiceIdentityContext(t.Context(), 1)
			getter := newGatedDashboardGetter(newFakeDashboard(ns, dashUID, folderUID))
			resolver.client = getter

			cancelCtx, cancel := context.WithCancel(ctx)
			var wg sync.WaitGroup
			wg.Go(func() {
				_, _ = resolver.ResolveFolder(cancelCtx, ns, dashUID)
			})
			synctest.Wait()

			var waiterFolder string
			var waiterErr error
			wg.Go(func() {
				waiterFolder, waiterErr = resolver.ResolveFolder(ctx, ns, dashUID)
			})
			synctest.Wait()
			require.Equal(t, int32(1), getter.hits.Load(), "the waiter should share the in-flight fetch")

			cancel()
			synctest.Wait()
			close(getter.release)
			wg.Wait()

			require.NoError(t, waiterErr, "a waiter with a valid context should not fail because another caller's context was cancelled")
			assert.Equal(t, folderUID, waiterFolder)
		})
	})

	t.Run("shared fetch times out if the downstream call hangs", func(t *testing.T) {
		resolver, _ := newTestDashboardFolderResolver(true, newFakeDashboard(ns, dashUID, folderUID))
		resolver.fetchTimeout = 10 * time.Millisecond
		resolver.client = newGatedDashboardGetter(nil)

		_, err := resolver.ResolveFolder(ctx, ns, dashUID)
		require.Error(t, err, "the shared fetch should time out if the downstream call hangs")
	})
}
