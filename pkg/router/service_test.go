package router

import (
	"context"
	"net/http"
	"net/http/httptest"
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
	features := featuremgmt.WithFeatures()
	svc, err := ProvideService(cfg, features, dummyRoutesLoader{}, httpRouter, ready, prometheus.NewRegistry())
	require.NoError(t, err)

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

	_, err := ProvideService(nil, features, dummyRoutesLoader{}, mux.NewRouter(), nil, nil)
	require.ErrorContains(t, err, "configuration is required")

	_, err = ProvideService(cfg, features, nil, mux.NewRouter(), nil, nil)
	require.ErrorContains(t, err, "routes loader is required")

	_, err = ProvideService(cfg, features, dummyRoutesLoader{}, nil, nil, nil)
	require.ErrorContains(t, err, "HTTP router is required")
}

func TestProvideServiceRegistersStandalonePathPrefixes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	httpRouter := mux.NewRouter()
	features := featuremgmt.WithFeatures()

	_, err := ProvideService(cfg, features, dummyRoutesLoader{}, httpRouter, nil, prometheus.NewRegistry())
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

func TestServiceRoutesUnmatchedRequestsThroughMiddleware(t *testing.T) {
	cfg := setting.NewCfg()
	httpRouter := mux.NewRouter()
	httpRouter.HandleFunc("/apis/legacy.grafana.app/v1", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	httpRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)

	svc, err := ProvideService(cfg, features, dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}}, httpRouter, nil, prometheus.NewRegistry())
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
		httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil))

		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "dummy backend for group: dummy-backend-1.ext.grafana.app", recorder.Body.String())
	})

	t.Run("existing route falls through", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/legacy.grafana.app/v1", nil))

		require.Equal(t, http.StatusNoContent, recorder.Code)
	})

	t.Run("unknown route preserves not found handler", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/apis/unknown.grafana.app/v1", nil))

		require.Equal(t, http.StatusTeapot, recorder.Code)
	})
}

func TestProvideMiddlewareServiceHonorsFeatureToggle(t *testing.T) {
	loader := dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}}

	enabled, err := ProvideMiddlewareService(featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.False(t, enabled.IsDisabled())

	disabled, err := ProvideMiddlewareService(featuremgmt.WithFeatures(), loader, prometheus.NewRegistry())
	require.NoError(t, err)
	require.True(t, disabled.IsDisabled())

	recorder := httptest.NewRecorder()
	disabled.HandleFunc(recorder, httptest.NewRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	require.Equal(t, http.StatusNoContent, recorder.Code)
}
