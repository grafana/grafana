package builder

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	restful "github.com/emicklei/go-restful/v3"
	"github.com/stretchr/testify/require"
	apidiscoveryv2 "k8s.io/api/apidiscovery/v2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	discoveryendpoint "k8s.io/apiserver/pkg/endpoints/discovery/aggregated"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serverstorage "k8s.io/apiserver/pkg/server/storage"
	clientrest "k8s.io/client-go/rest"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

var (
	routeGroupV0alpha1 = schema.GroupVersion{Group: "routes.grafana.app", Version: "v0alpha1"}
	routeGroupV1       = schema.GroupVersion{Group: "routes.grafana.app", Version: "v1"}
	routeGroupV2alpha1 = schema.GroupVersion{Group: "routes.grafana.app", Version: "v2alpha1"}
	routeGroupV3       = schema.GroupVersion{Group: "routes.grafana.app", Version: "v3"}
)

func TestRouteVersions(t *testing.T) {
	b := &routeOnlyBuilder{
		versions: []schema.GroupVersion{routeGroupV3, routeGroupV2alpha1, routeGroupV1},
		routes: map[schema.GroupVersion]*APIRoutes{
			routeGroupV1:       helloRoutes(),
			routeGroupV2alpha1: helloRoutes(),
			routeGroupV3:       {},
		},
	}
	g := &genericapiserver.APIGroupInfo{PrioritizedVersions: []schema.GroupVersion{routeGroupV1, routeGroupV2alpha1, routeGroupV3}}

	// v3 has no routes, and the rest are in priority order.
	require.Equal(t, []schema.GroupVersion{routeGroupV1, routeGroupV2alpha1}, routeVersions(g, []APIGroupBuilder{b}, nil, false))

	config := serverstorage.NewResourceConfig()
	config.EnableVersions(routeGroupV1)
	config.DisableVersions(routeGroupV2alpha1)
	require.Equal(t, []schema.GroupVersion{routeGroupV1}, routeVersions(g, []APIGroupBuilder{b}, config, false))
}

func TestRouteVersions_V0alpha1(t *testing.T) {
	g := &genericapiserver.APIGroupInfo{PrioritizedVersions: []schema.GroupVersion{routeGroupV0alpha1}}
	b := &routeOnlyBuilder{
		versions: []schema.GroupVersion{routeGroupV0alpha1},
		routes:   map[schema.GroupVersion]*APIRoutes{routeGroupV0alpha1: helloRoutes()},
	}

	require.Empty(t, routeVersions(g, []APIGroupBuilder{b}, nil, false))
	require.Equal(t, []schema.GroupVersion{routeGroupV0alpha1}, routeVersions(g, []APIGroupBuilder{b}, nil, true))

	b.allowedV0Alpha1 = []string{AllResourcesAllowed}
	require.Equal(t, []schema.GroupVersion{routeGroupV0alpha1}, routeVersions(g, []APIGroupBuilder{b}, nil, false))
}

func TestInstallAPIGroupWithRoutes(t *testing.T) {
	t.Run("advertises a group that only serves custom routes", func(t *testing.T) {
		server := newRouteDiscoveryTestServer(t)
		g := &genericapiserver.APIGroupInfo{PrioritizedVersions: []schema.GroupVersion{routeGroupV1}}
		b := &routeOnlyBuilder{
			versions: []schema.GroupVersion{routeGroupV1},
			routes:   map[schema.GroupVersion]*APIRoutes{routeGroupV1: helloRoutes()},
		}

		require.NoError(t, InstallAPIGroupWithRoutes(server, g, []APIGroupBuilder{b}, nil, false))

		want := []metav1.GroupVersionForDiscovery{{GroupVersion: "routes.grafana.app/v1", Version: "v1"}}
		require.Equal(t, want, listedVersions(t, server, routeGroupV1.Group))

		group := getJSON[metav1.APIGroup](t, server, "/apis/routes.grafana.app")
		require.Equal(t, want, group.Versions)
		require.Equal(t, "v1", group.PreferredVersion.Version)

		resources := getJSON[metav1.APIResourceList](t, server, "/apis/routes.grafana.app/v1")
		require.Equal(t, "routes.grafana.app/v1", resources.GroupVersion)
		require.Empty(t, resources.APIResources)

		aggregated := aggregatedVersions(t, server, routeGroupV1.Group)
		require.Len(t, aggregated, 1)
		require.Equal(t, "v1", aggregated[0].Version)
		require.Equal(t, apidiscoveryv2.DiscoveryFreshnessCurrent, aggregated[0].Freshness)
		require.Empty(t, aggregated[0].Resources)

		// The routes are mounted on the version's WebService afterwards.
		require.NoError(t, AugmentWebServicesWithCustomRoutes(server.Handler.GoRestfulContainer, []APIGroupBuilder{b}, nil, nil))

		rec := httptest.NewRecorder()
		server.Handler.GoRestfulContainer.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis/routes.grafana.app/v1/namespaces/default/hello", nil))
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "hello", rec.Body.String())
	})

	t.Run("skips a group with no resources or routes", func(t *testing.T) {
		server := newRouteDiscoveryTestServer(t)
		g := &genericapiserver.APIGroupInfo{PrioritizedVersions: []schema.GroupVersion{routeGroupV1}}
		b := &routeOnlyBuilder{versions: []schema.GroupVersion{routeGroupV1}}

		require.NoError(t, InstallAPIGroupWithRoutes(server, g, []APIGroupBuilder{b}, nil, false))

		rec := httptest.NewRecorder()
		server.Handler.GoRestfulContainer.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis/routes.grafana.app", nil))
		require.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("returns an error for discovery that is already registered", func(t *testing.T) {
		server := newRouteDiscoveryTestServer(t)
		existing := new(restful.WebService)
		existing.Path("/apis/routes.grafana.app")
		server.Handler.GoRestfulContainer.Add(existing)
		g := &genericapiserver.APIGroupInfo{PrioritizedVersions: []schema.GroupVersion{routeGroupV1}}
		b := &routeOnlyBuilder{
			versions: []schema.GroupVersion{routeGroupV1},
			routes:   map[schema.GroupVersion]*APIRoutes{routeGroupV1: helloRoutes()},
		}

		require.ErrorContains(t, InstallAPIGroupWithRoutes(server, g, []APIGroupBuilder{b}, nil, false), "already registered")
	})
}

func newRouteDiscoveryTestServer(t *testing.T) *genericapiserver.GenericAPIServer {
	t.Helper()
	scheme := ProvideScheme()
	config := genericapiserver.NewRecommendedConfig(ProvideCodecFactory(scheme))
	config.ExternalAddress = "localhost:3000"
	config.LoopbackClientConfig = &clientrest.Config{Host: config.ExternalAddress}
	config.EffectiveVersion = GetEffectiveVersion(0, "13.0.0", "", "")
	config.AggregatedDiscoveryGroupManager = discoveryendpoint.NewResourceManager("apis")
	server, err := config.Complete().New("test", genericapiserver.NewEmptyDelegate())
	require.NoError(t, err)
	t.Cleanup(server.Destroy)
	return server
}

func getJSON[T any](t *testing.T, server *genericapiserver.GenericAPIServer, path string) T {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.Header.Set("Accept", "application/json")
	server.Handler.GoRestfulContainer.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, "GET %s: %s", path, rec.Body.String())

	var v T
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &v))
	return v
}

// listedVersions returns the versions /apis lists for group.
func listedVersions(t *testing.T, server *genericapiserver.GenericAPIServer, group string) []metav1.GroupVersionForDiscovery {
	t.Helper()
	for _, g := range getJSON[metav1.APIGroupList](t, server, "/apis").Groups {
		if g.Name == group {
			return g.Versions
		}
	}
	t.Fatalf("group %s not in /apis", group)
	return nil
}

func aggregatedVersions(t *testing.T, server *genericapiserver.GenericAPIServer, group string) []apidiscoveryv2.APIVersionDiscovery {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis", nil)
	req.Header.Set("Accept", "application/json;g=apidiscovery.k8s.io;v=v2;as=APIGroupDiscoveryList")
	server.AggregatedDiscoveryGroupManager.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())

	var list apidiscoveryv2.APIGroupDiscoveryList
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &list))
	for _, g := range list.Items {
		if g.Name == group {
			return g.Versions
		}
	}
	t.Fatalf("group %s not in aggregated discovery", group)
	return nil
}

func helloRoutes() *APIRoutes {
	return &APIRoutes{Namespace: []APIRouteHandler{{
		Path: "hello",
		Spec: &spec3.PathProps{Get: &spec3.Operation{OperationProps: spec3.OperationProps{OperationId: "getHello"}}},
		Handler: func(w http.ResponseWriter, _ *http.Request) {
			_, _ = w.Write([]byte("hello"))
		},
	}}}
}

type routeOnlyBuilder struct {
	versions        []schema.GroupVersion
	routes          map[schema.GroupVersion]*APIRoutes
	allowedV0Alpha1 []string
}

func (b *routeOnlyBuilder) InstallSchema(*runtime.Scheme) error { return nil }
func (b *routeOnlyBuilder) UpdateAPIGroupInfo(*genericapiserver.APIGroupInfo, APIGroupOptions) error {
	return nil
}
func (b *routeOnlyBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions { return nil }
func (b *routeOnlyBuilder) AllowedV0Alpha1Resources() []string                  { return b.allowedV0Alpha1 }
func (b *routeOnlyBuilder) GetGroupVersions() []schema.GroupVersion             { return b.versions }
func (b *routeOnlyBuilder) GetAPIRoutes(gv schema.GroupVersion) *APIRoutes      { return b.routes[gv] }
