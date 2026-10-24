package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	"k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func stackConfig() *setting.Cfg {
	cfg := setting.NewCfg()
	cfg.StackID = "1"
	section := func(name, key, value string) { cfg.Raw.Section(name).Key(key).SetValue(value) }
	section(cloudRouterSection, mtRouterAddressKey, "https://mt-router:3000")
	section("grpc_client_authentication", "token", "policy-token")
	section("grpc_client_authentication", "token_exchange_url", "https://auth.example.com/exchange")
	return cfg
}

// A full Grafana server builds its loader with ProvideRoutesLoader, so that is
// where the router's groups have to be added.
func TestProvideRoutesLoaderAddsTheRoutersGroupsOnACloudStack(t *testing.T) {
	middleware := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)
	provide := func(cfg *setting.Cfg, features featuremgmt.FeatureToggles) RoutesLoader {
		t.Helper()
		loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{Features: features})
		require.NoError(t, err)
		return loader
	}

	require.True(t, isMTRoutes(provide(stackConfig(), middleware)))
	require.False(t, isMTRoutes(provide(stackConfig(), featuremgmt.WithFeatures())), "without router middleware")

	selfManaged := stackConfig()
	selfManaged.StackID = ""
	require.False(t, isMTRoutes(provide(selfManaged, middleware)), "not a cloud stack")

	standalone := stackConfig()
	standalone.Target = []string{"router"}
	require.False(t, isMTRoutes(provide(standalone, middleware)), "the standalone router is the multi-tenant router")

	noAddress := stackConfig()
	noAddress.Raw.Section(cloudRouterSection).Key(mtRouterAddressKey).SetValue("")
	require.False(t, isMTRoutes(provide(noAddress, middleware)))
}

// The whole path on a stack: the router's groups are polled, the embedded
// apiserver's are read once it is ready, and a request for each goes where it
// should, through the stack's own discovery, metrics and breakers.
func TestStackServesTheRoutersGroups(t *testing.T) {
	mt := newFakeMTRouter(t, "mt.grafana.app", "local.grafana.app")
	api := newFakeAPIServer(t, true, "local.grafana.app")
	routes, err := buildMTRoutes(&mutableLoader{}, testMTConfig(mt.URL))
	require.NoError(t, err)

	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)
	reg := prometheus.NewRegistry()
	svc, err := ProvideService(stackConfig(), features, routes, reg, NewGrafanaRouter(nil, nil))
	require.NoError(t, err)
	require.True(t, svc.middleware)

	ctx := t.Context()
	require.NoError(t, svc.router.Run(ctx))
	require.NoError(t, svc.WatchLocalGroups(ctx, &rest.Config{Host: api.URL}))
	require.Eventually(t, func() bool { return svc.router.KnownGroup("mt.grafana.app") }, 5*time.Second, 10*time.Millisecond)
	require.False(t, svc.router.KnownGroup("local.grafana.app"), "a local group stays with the embedded apiserver")

	local := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/apis" {
			serveLocalDiscovery(w, req.Header.Get("Accept") == aggregatedDiscoveryJSON, []string{"local.grafana.app"})
			return
		}
		w.WriteHeader(http.StatusTeapot)
	})
	get := func(path, accept, header string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{
			Type: types.TypeUser, UserUID: "test-user", OrgID: 1, Namespace: "*", AccessToken: "caller-token",
		}))
		if accept != "" {
			req.Header.Set("Accept", accept)
		}
		if header != "" {
			req.Header.Set(routerOriginHeader, header)
		}
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, req, local)
		return recorder
	}

	// The router's group is proxied to it, as the caller, marked as forwarded.
	require.Equal(t, http.StatusAccepted, get("/apis/mt.grafana.app/v1/namespaces/default/things", "", "").Code)
	require.True(t, mt.markerSeen.Load())
	require.Equal(t, "Bearer caller-token", mt.proxiedToken.Load(), "the router sees the caller, not the stack's access policy")
	// A local group, and a group nobody serves, stay with the embedded apiserver.
	require.Equal(t, http.StatusTeapot, get("/apis/local.grafana.app/v1/namespaces/default/things", "", "").Code)
	require.Equal(t, http.StatusTeapot, get("/apis/nobody.grafana.app/v1/namespaces/default/things", "", "").Code)

	// Discovery lists both, and a request that skips the router lists only the stack's.
	require.Equal(t, []string{discoveryGroup, "local.grafana.app", "mt.grafana.app"}, legacyGroupsVia(t, svc, local, ""))
	require.Equal(t, []string{discoveryGroup, "local.grafana.app"}, legacyGroupsVia(t, svc, local, routerOriginHeader+"="+originMT))

	// Its OpenAPI document comes from the router, and the stack's index lists it.
	doc := get("/openapi/v3/apis/mt.grafana.app/v1", "", "")
	require.Equal(t, http.StatusOK, doc.Code, doc.Body.String())
	require.Contains(t, doc.Body.String(), `"title":"mt"`)
	index := get("/openapi/v3", "", "")
	require.Equal(t, http.StatusOK, index.Code)
	require.Contains(t, index.Body.String(), "apis/mt.grafana.app/v1")
	require.NotContains(t, get("/openapi/v3", "", originMT).Body.String(), "apis/mt.grafana.app/v1")

	// The proxied request is the router's own, so it has the real group as its metric label.
	families, err := reg.Gather()
	require.NoError(t, err)
	found := false
	for _, f := range families {
		if f.GetName() != "grafana_router_http_requests_total" {
			continue
		}
		for _, m := range f.GetMetric() {
			labels := map[string]string{}
			for _, l := range m.GetLabel() {
				labels[l.GetName()] = l.GetValue()
			}
			if labels["group"] == "mt.grafana.app" && labels["route"] == routeBackend && labels["status_code"] == "202" {
				found = true
			}
		}
	}
	require.True(t, found, "a request counted under the router's group")
}

// legacyGroupsVia reads the stack's root discovery through the service.
func legacyGroupsVia(t *testing.T, svc *Service, next http.Handler, header string) []string {
	t.Helper()
	return legacyGroupsWith(t, svc.HandleFunc, next, header)
}

func isMTRoutes(loader RoutesLoader) bool {
	_, ok := loader.(*mtRoutes)
	return ok
}
