package router

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/gorilla/mux"
	"github.com/grafana/authlib/types"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	httpRouter := mux.NewRouter()
	ready := &testReadyNotifier{}
	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware)
	svc, err := provideTestService(cfg, features, dummyRoutesLoader{})
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
	httpRouter.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, "/apis", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"kind":"APIGroupList","apiVersion":"v1","groups":[
		{"name":"discovery","versions":[{"groupVersion":"discovery/v1alpha2","version":"v1alpha2"}],"preferredVersion":{"groupVersion":"discovery/v1alpha2","version":"v1alpha2"}}
	]}`, recorder.Body.String())

	recorder = httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, "/not-owned", nil))
	require.Equal(t, http.StatusNotFound, recorder.Code)

	for _, path := range []string{
		"/apis/unknown.grafana.app/v1/widgets",
		"/openapi/v3/apis/unknown.grafana.app/v1",
	} {
		recorder = httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, path, nil))
		require.Equal(t, http.StatusNotFound, recorder.Code, path)
	}
}

func TestProvideServiceRequiresCollaborators(t *testing.T) {
	cfg := setting.NewCfg()
	features := featuremgmt.WithFeatures()
	_, err := provideTestService(cfg, features, nil)
	require.ErrorContains(t, err, "routes loader is required")
}

func TestServiceRegistersTargetPathPrefixes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.Target = []string{"router"}
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	httpRouter := mux.NewRouter()
	features := featuremgmt.WithFeatures()

	svc, err := provideTestService(cfg, features, dummyRoutesLoader{})
	require.NoError(t, err)
	err = svc.RegisterTargetRoutes(httpRouter, nil)
	require.NoError(t, err)

	for _, path := range []string{
		"/apis/example.grafana.app/v1/widgets",
		"/openapi/v3/apis/example.grafana.app/v1",
	} {
		t.Run(path, func(t *testing.T) {
			var match mux.RouteMatch
			require.True(t, httpRouter.Match(newAuthenticatedRequest(http.MethodGet, path, nil), &match))
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

	svc, err := provideTestService(cfg, features, dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}})
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
		svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), httpRouter)

		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, "dummy backend for group: dummy-backend-1.ext.grafana.app", recorder.Body.String())
	})

	t.Run("existing route falls through", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/legacy.grafana.app/v1", nil), httpRouter)

		require.Equal(t, http.StatusNoContent, recorder.Code)
	})

	t.Run("unknown route preserves not found handler", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/unknown.grafana.app/v1", nil), httpRouter)

		require.Equal(t, http.StatusTeapot, recorder.Code)
	})
}

func TestProvideServiceHonorsFeatureToggle(t *testing.T) {
	cfg := setting.NewCfg()
	loader := dummyRoutesLoader{groups: []string{"dummy-backend-1.ext.grafana.app"}}

	// Without the toggle the router still runs, to keep /apis/discovery current,
	// but leaves every other request to the embedded API server.
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(), loader)
	require.NoError(t, err)

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	})
	recorder := httptest.NewRecorder()
	svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), next)
	require.Equal(t, http.StatusNoContent, recorder.Code)

	recorder = httptest.NewRecorder()
	svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, manifestDiscoveryList, nil), next)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"kind":"AppManifestList"`)
}

// Restricted groups are served to allowlisted services in both modes, since
// Grafana's own authentication carries the same token claims as the router's.
func TestProvideServiceSetsTheInternalCallerPolicy(t *testing.T) {
	operator := tokenIdentity(types.TypeUser, "access-policy:operator-cap", "mobile-operator")
	endUser := tokenIdentity(types.TypeUser, "access-policy:authn-cap", "grafana-authn-service")
	request := func(requester identity.Requester) *http.Request {
		req := httptest.NewRequest(http.MethodGet, "/apis/"+hiddenGroup+"/v1/things", nil)
		return req.WithContext(identity.WithRequester(req.Context(), requester))
	}
	build := func(t *testing.T, features featuremgmt.FeatureToggles, target ...string) *Service {
		cfg := cfgWithCloudRouterSection(t, map[string]string{"internal_identities": "mobile-operator"})
		cfg.Target = target
		cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
		cfg.ExtJWTAuth.Audiences = []string{"grafana"}
		svc, err := provideTestService(cfg, features, &mutableLoader{backends: []Backend{newRestrictedTestBackend(hiddenGroup, true)}})
		require.NoError(t, err)
		require.NoError(t, svc.router.reconcile(t.Context()))
		return svc
	}

	t.Run("middleware", func(t *testing.T) {
		svc := build(t, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware))
		next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
		served := httptest.NewRecorder()
		svc.HandleFunc(served, request(operator), next)
		require.Equal(t, hiddenGroup, served.Body.String())
		hidden := httptest.NewRecorder()
		svc.HandleFunc(hidden, request(endUser), next)
		require.Equal(t, http.StatusTeapot, hidden.Code)
	})

	t.Run("router target", func(t *testing.T) {
		svc := build(t, featuremgmt.WithFeatures(), "router")
		httpRouter := mux.NewRouter()
		require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
		served := httptest.NewRecorder()
		httpRouter.ServeHTTP(served, request(operator))
		require.Equal(t, hiddenGroup, served.Body.String())
		hidden := httptest.NewRecorder()
		httpRouter.ServeHTTP(hidden, request(endUser))
		require.Equal(t, http.StatusNotFound, hidden.Code)
	})
}

// provideTestService builds the service the way wire does: the router first,
// then the service around it.
func provideTestService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, loader RoutesLoader) (*Service, error) {
	r, err := ProvideGrafanaRouter(cfg)
	if err != nil {
		return nil, err
	}
	return ProvideService(cfg, features, loader, prometheus.NewRegistry(), r)
}

// Wire hands the same router to storage, as a ManifestDiscovery, and to the
// service, so storage reads what the running service publishes.
func TestProvideServiceUsesTheProvidedRouter(t *testing.T) {
	r := NewGrafanaRouter(nil, nil)
	svc, err := ProvideService(setting.NewCfg(), featuremgmt.WithFeatures(), dummyRoutesLoader{}, prometheus.NewRegistry(), r)
	require.NoError(t, err)
	require.Same(t, r, svc.router)
}

func TestRouterTargetCloudFallback(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		cfg := setting.NewCfg()
		cfg.Target = []string{"router"}
		cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
		cfg.ExtJWTAuth.Audiences = []string{"grafana"}
		loader := &cloudLoader{BasicService: services.NewIdleService(nil, nil)}
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
		svc, err := provideTestService(cfg, featuremgmt.WithFeatures(), loader)
		require.NoError(t, err)
		httpRouter := mux.NewRouter()
		httpRouter.NotFoundHandler = http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
		require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
		recorder := httptest.NewRecorder()
		httpRouter.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/example/v1/namespaces/stacks-123/widgets", nil))
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
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	loader, err := ProvideRoutesLoader(cfg, PluginLoaderDependencies{})
	require.NoError(t, err)
	cloud := loader.(*cloudLoader)
	cloud.singleTenantFallback.transport = testFallbackTransport(func(req *http.Request) (*http.Response, error) {
		require.Equal(t, "https://discovery.example.com/apis", req.URL.String())
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"kind":"APIGroupList","apiVersion":"v1","groups":[{"name":"fallback.example.com","versions":[],"preferredVersion":{"groupVersion":"","version":""}}]}`))}, nil
	})
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(), loader)
	require.NoError(t, err)
	httpRouter := mux.NewRouter()
	require.NoError(t, svc.RegisterTargetRoutes(httpRouter, nil))
	pollDiscovery(t, cloud.singleTenantFallback)
	require.NoError(t, svc.router.reconcile(t.Context()))
	recorder := httptest.NewRecorder()
	httpRouter.ServeHTTP(recorder, newAuthenticatedRequest(http.MethodGet, "/apis", nil))
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "fallback.example.com")
}

func TestRouterMiddlewarePreservesDelegateWithSTLoader(t *testing.T) {
	cfg := setting.NewCfg()
	loader := &cloudLoader{BasicService: services.NewIdleService(nil, nil), singleTenantFallback: newTestSingleTenantFallback(t)}
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader)
	require.NoError(t, err)
	require.NoError(t, svc.RegisterTargetRoutes(mux.NewRouter(), nil))
	recorder := httptest.NewRecorder()
	svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/unknown/v1/namespaces/stacks-123/widgets", nil), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	require.Equal(t, http.StatusTeapot, recorder.Code)
}

// lifecycleLoader is a routes loader with its own background lifecycle, like
// the cloud loader.
type lifecycleLoader struct {
	dummyRoutesLoader
	services.Service
}

// The service runs the loader's own lifecycle, both inside Grafana and as the
// router module, so it starts and stops with the router.
func TestServiceRunsLoaderLifecycle(t *testing.T) {
	for _, target := range [][]string{nil, {"router"}} {
		cfg := setting.NewCfg()
		cfg.Target = target
		loader := lifecycleLoader{Service: services.NewIdleService(nil, nil)}
		svc, err := ProvideService(cfg, featuremgmt.WithFeatures(), loader, prometheus.NewRegistry(), NewGrafanaRouter(nil, nil))
		require.NoError(t, err)

		require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
		require.Equal(t, services.Running, loader.State())

		require.NoError(t, services.StopAndAwaitTerminated(t.Context(), svc))
		require.Equal(t, services.Terminated, loader.State())
	}
}

// A failed loader fails the service.
func TestServiceFailsWhenLoaderFails(t *testing.T) {
	loader := lifecycleLoader{Service: services.NewBasicService(nil, func(ctx context.Context) error {
		return errors.New("poll loop crashed")
	}, nil)}
	svc, err := provideTestService(setting.NewCfg(), featuremgmt.WithFeatures(), loader)
	require.NoError(t, err)

	require.NoError(t, svc.StartAsync(t.Context()))
	err = svc.AwaitTerminated(t.Context())
	require.ErrorContains(t, err, "poll loop crashed")
}

// notifyFailingLoader makes the router fail to start after its loader has.
type notifyFailingLoader struct{ lifecycleLoader }

func (notifyFailingLoader) Notify(context.Context) (<-chan struct{}, error) {
	return nil, errors.New("notify unavailable")
}

// dskit doesn't call stopping when starting fails, so the service must stop a
// loader it already started.
func TestServiceStopsLoaderWhenStartingFails(t *testing.T) {
	loader := notifyFailingLoader{lifecycleLoader{Service: services.NewIdleService(nil, nil)}}
	svc, err := provideTestService(setting.NewCfg(), featuremgmt.WithFeatures(), loader)
	require.NoError(t, err)

	require.ErrorContains(t, services.StartAndAwaitRunning(t.Context(), svc), "notify unavailable")
	require.Equal(t, services.Terminated, loader.State())
}

func TestServiceMiddlewarePassesRequestsItDoesNotOwnToNext(t *testing.T) {
	svc := newService(NewGrafanaRouter(dummyRoutesLoader{groups: []string{"owned.grafana.app"}}, nil), prometheus.NewRegistry())
	svc.middleware = true
	require.NoError(t, svc.router.reconcile(t.Context()))

	for _, target := range []string{
		"/apis/dashboard.grafana.app/v1/namespaces/default/dashboards",
		"/apis/dashboard.grafana.app",
		"/apis/Not_A.Group/v1/things",
		"/openapi/v3/apis/dashboard.grafana.app/v1",
		"/openapi/v3/apis/owned.grafana.app",
		"/api/dashboards/uid/abc",
	} {
		t.Run(target, func(t *testing.T) {
			// The shortcut must answer as the router would: through next.
			for name, serve := range map[string]func(http.ResponseWriter, *http.Request, http.Handler){
				"service": svc.HandleFunc,
				"router":  svc.router.HandleFunc,
			} {
				var called bool
				next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
					called = true
					w.WriteHeader(http.StatusTeapot)
				})
				rec := httptest.NewRecorder()
				serve(rec, newAuthenticatedRequest(http.MethodGet, target, nil), next)
				require.True(t, called, "%s did not call next", name)
				require.Equal(t, http.StatusTeapot, rec.Code, name)
			}
		})
	}
}

// App plugin settings are only served by the router, so enabling them inside
// Grafana also enables the router middleware. The standalone router has no
// embedded API server, so the settings flag does not change it.
func TestMiddlewareEnabledBySettingsAPI(t *testing.T) {
	grafana := setting.NewCfg()
	standalone := setting.NewCfg()
	standalone.Target = []string{"router"}
	for _, tc := range []struct {
		name     string
		cfg      *setting.Cfg
		flags    []any
		expected bool
	}{
		{"no flags", grafana, nil, false},
		{"router middleware", grafana, []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, true},
		{"settings API", grafana, []any{featuremgmt.FlagApppluginsRegisterAPIServer}, true},
		{"standalone router with the settings API", standalone, []any{featuremgmt.FlagApppluginsRegisterAPIServer}, false},
		{"standalone router with router middleware", standalone, []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			features := featuremgmt.WithFeatures(tc.flags...)
			require.Equal(t, tc.expected, middlewareEnabled(tc.cfg, features))
			svc, err := ProvideService(tc.cfg, features, dummyRoutesLoader{}, prometheus.NewRegistry(), NewGrafanaRouter(nil, nil))
			require.NoError(t, err)
			require.Equal(t, tc.expected, svc.middleware)
		})
	}
	require.False(t, middlewareEnabled(grafana, nil))
}
