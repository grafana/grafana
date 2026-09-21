package annotation

import (
	"testing"
	"time"

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
		client: &dashboardClient{gvr: gvr, dyn: fakeDyn},
		tracer: testTracer,
	}
	if cacheEnabled {
		r.cache = localcache.New(testCacheTTL, time.Minute)
		r.cacheTTL = testCacheTTL
	}
	return r, fakeDyn
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
}
