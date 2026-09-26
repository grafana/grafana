package router

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

type testReadyNotifier struct {
	ready atomic.Bool
}

func (n *testReadyNotifier) SetReady()    { n.ready.Store(true) }
func (n *testReadyNotifier) SetNotReady() { n.ready.Store(false) }

func TestServiceRunsRouterAndRegistersRoutes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	httpRouter := mux.NewRouter()
	ready := &testReadyNotifier{}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)
	svc, err := ProvideService(cfg, features, dummyRoutesLoader{}, prometheus.NewRegistry())
	require.NoError(t, err)
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, ready))

	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})

	require.Eventually(t, func() bool {
		svc.reportReady(t.Context())
		return ready.ready.Load()
	}, readinessPollInterval, readinessPollInterval/10)

	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"kind":"APIGroupList","apiVersion":"v1","groups":[]}`, recorder.Body.String())

	recorder = httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/not-owned", nil))
	require.Equal(t, http.StatusNotFound, recorder.Code)

	for _, path := range []string{
		"/apis/unknown.grafana.app/v1/widgets",
		"/openapi/v3/apis/unknown.grafana.app/v1",
	} {
		recorder = httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		require.Equal(t, http.StatusNotFound, recorder.Code, path)
	}
}

func TestProvideServiceRequiresCollaborators(t *testing.T) {
	cfg := setting.NewCfg()
	features := featuremgmt.WithFeatures()
	_, err := ProvideService(cfg, features, nil, prometheus.NewRegistry())
	require.ErrorContains(t, err, "routes loader is required")
}

func TestServiceRegistersTargetPathPrefixes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	httpRouter := mux.NewRouter()
	features := featuremgmt.WithFeatures()

	svc, err := ProvideService(cfg, features, dummyRoutesLoader{}, prometheus.NewRegistry())
	require.NoError(t, err)
	err = svc.RegisterTargetRoutes(httpRouter, nil)
	require.NoError(t, err)

	for _, path := range []string{
		"/apis/example.grafana.app/v1/widgets",
		"/openapi/v3/apis/example.grafana.app/v1",
	} {
		t.Run(path, func(t *testing.T) {
			var match mux.RouteMatch
			require.True(t, httpRouter.Match(httptest.NewRequest(http.MethodGet, path, nil), &match))
			require.NoError(t, match.MatchErr)
		})
	}
}

func TestServiceRoutesUnmatchedRequestsThroughHandler(t *testing.T) {
	cfg := setting.NewCfg()
	httpRouter := mux.NewRouter()
	httpRouter.HandleFunc("/apis/legacy.grafana.app/v1", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	httpRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)

	svc, err := ProvideService(cfg, features, dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}}, prometheus.NewRegistry())
	require.NoError(t, err)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
	t.Cleanup(func() {
		require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
	})
	require.Eventually(t, func() bool {
		return svc.router.KnownGroup("dummy-backend-1.ext.grafana.app")
	}, readinessPollInterval, readinessPollInterval/10)

	t.Run("router-only group", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), httpRouter)

		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "dummy backend for group: dummy-backend-1.ext.grafana.app", recorder.Body.String())
	})

	t.Run("existing route falls through", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/legacy.grafana.app/v1", nil), httpRouter)

		require.Equal(t, http.StatusNoContent, recorder.Code)
	})

	t.Run("unknown route preserves not found handler", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/unknown.grafana.app/v1", nil), httpRouter)

		require.Equal(t, http.StatusTeapot, recorder.Code)
	})
}

func TestProvideServiceHonorsFeatureToggle(t *testing.T) {
	cfg := setting.NewCfg()
	loader := dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}}

	enabled, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.False(t, enabled.IsDisabled())

	disabled, err := ProvideService(cfg, featuremgmt.WithFeatures(), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.True(t, disabled.IsDisabled())

	recorder := httptest.NewRecorder()
	disabled.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	require.Equal(t, http.StatusNoContent, recorder.Code)
}

func TestRouterTargetCloudFallback(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		cfg := setting.NewCfg()
		cfg.Target = []string{"router"}
		loader := &cloudLoader{}
		if enabled {
			loader.singleTenantFallback = newTestSingleTenantFallback(t)
			loader.singleTenantFallback.resolveHost = func(context.Context, int64) (singleTenantStack, error) {
				return singleTenantStack{URL: "https://tenant.example.com"}, nil
			}
			loader.singleTenantFallback.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
				require.Equal(t, "tenant.example.com", req.URL.Host)
				return &http.Response{StatusCode: http.StatusNoContent, Header: make(http.Header), Body: http.NoBody}, nil
			})
		}
		svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), loader, prometheus.NewRegistry())
		require.NoError(t, err)
		httpRouter := mux.NewRouter()
		httpRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
		require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
		recorder := httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
		if enabled {
			require.Equal(t, http.StatusNoContent, recorder.Code)
		} else {
			require.Equal(t, http.StatusTeapot, recorder.Code)
		}
	}
}

func TestRouterTargetServesRegisteredSingleTenantDiscovery(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "https://discovery.example.com"})
	cfg.Target = []string{"router"}
	loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{})
	require.NoError(t, err)
	cloud := loader.(*cloudLoader)
	cloud.singleTenantFallback.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, "https://discovery.example.com/apis", req.URL.String())
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"fallback.example.com","versions":[],"preferredVersion":{"groupVersion":"","version":""}}]}`))}, nil
	})
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	httpRouter := mux.NewRouter()
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
	pollDiscovery(t, cloud.singleTenantFallback)
	require.NoError(t, svc.router.reconcile(t.Context()))
	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "fallback.example.com")
}

func TestRouterMiddlewarePreservesDelegateWithSTLoader(t *testing.T) {
	cfg := setting.NewCfg()
	loader := &cloudLoader{singleTenantFallback: newTestSingleTenantFallback(t)}
	svc, err := ProvideService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.NoError(t, svc.RegisterTargetRoutes(mux.NewRouter(), nil))
	recorder := httptest.NewRecorder()
	svc.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/unknown/v1/namespaces/stacks-123/widgets", nil), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	require.Equal(t, http.StatusTeapot, recorder.Code)
}
