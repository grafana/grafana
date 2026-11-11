package router

import (
	"context"
	"errors"
	"io"
	"maps"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"testing/synctest"

	"github.com/gorilla/mux"
	"github.com/grafana/dskit/services"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
	router, err := ProvideGrafanaRouter(cfg)
	require.NoError(t, err)
	synctest.Test(t, func(t *testing.T) {
		svc, err := ProvideService(cfg, features, dummyRoutesLoader{}, prometheus.NewRegistry(), router)
		require.NoError(t, err)
		require.NoError(t, svc.RegisterTargetRoutes(httpRouter, ready))

		require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
		t.Cleanup(func() {
			require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
		})

		// Complete initial reconciliation before asking the service to publish readiness.
		synctest.Wait()

		svc.reportReady(t.Context())
		require.True(t, ready.ready.Load())

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
	})
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

func TestServiceMiddlewareServesTheAPITree(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
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
		svc.SetUpstream(&fakeEmbeddedAPIServer{groups: []string{"legacy.grafana.app"}, status: http.StatusNoContent})
		require.NoError(t, services.StartAndAwaitRunning(t.Context(), svc))
		t.Cleanup(func() {
			require.NoError(t, services.StopAndAwaitTerminated(context.Background(), svc))
		})

		// Finish initial route reconciliation before sending middleware requests.
		synctest.Wait()

		require.True(t, svc.router.KnownGroup("dummy-backend-1.ext.grafana.app"))

		{
			recorder := httptest.NewRecorder()
			svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/dummy-backend-1.ext.grafana.app/v0alpha1", nil), httpRouter)

			require.Equal(t, http.StatusOK, recorder.Code)
			require.Equal(t, "dummy backend for group: dummy-backend-1.ext.grafana.app", recorder.Body.String())
		}

		{
			recorder := httptest.NewRecorder()
			svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/legacy.grafana.app/v1", nil), httpRouter)

			require.Equal(t, http.StatusNoContent, recorder.Code)
		}

		{
			recorder := httptest.NewRecorder()
			svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/unknown.grafana.app/v1", nil), httpRouter)

			require.Equal(t, http.StatusNotFound, recorder.Code)
		}

		{
			recorder := httptest.NewRecorder()
			svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/api/health", nil), httpRouter)

			require.Equal(t, http.StatusTeapot, recorder.Code)
		}
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
			require.Equal(t, http.StatusNotFound, recorder.Code)
		}
	}
}

func TestRouterTargetServesRegisteredSingleTenantDiscovery(t *testing.T) {
	cfg := cfgWithCloudRouterSection(t, map[string]string{"st_discovery_url": "https://discovery.example.com"})
	cfg.Target = []string{"router"}
	cfg.ExtJWTAuth.JWKSUrl = "https://jwks.invalid/keys"
	cfg.ExtJWTAuth.Audiences = []string{"grafana"}
	loader, err := NewCloudRoutesLoader(cfg, PluginDependencies{})
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

func TestRouterMiddlewareDoesNotUseSTFallback(t *testing.T) {
	cfg := setting.NewCfg()
	loader := &cloudLoader{BasicService: services.NewIdleService(nil, nil), singleTenantFallback: newTestSingleTenantFallback(t)}
	svc, err := provideTestService(cfg, featuremgmt.WithFeatures(featuremgmt.FlagGrafanaUseRouterMiddleware), loader)
	require.NoError(t, err)
	require.NoError(t, svc.RegisterTargetRoutes(mux.NewRouter(), nil))
	// As if its first reconcile succeeded, so the router serves the request.
	svc.router.initialized.Store(true)
	recorder := httptest.NewRecorder()
	svc.HandleFunc(recorder, newAuthenticatedRequest(http.MethodGet, "/apis/unknown/v1/namespaces/stacks-123/widgets", nil), http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	}))
	require.Equal(t, http.StatusNotFound, recorder.Code)
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

func TestServiceMiddlewareCapturesAPITrees(t *testing.T) {
	svc := newService(NewGrafanaRouter(dummyRoutesLoader{groups: []string{"owned.grafana.app"}}, nil), prometheus.NewRegistry())
	svc.middleware = true
	require.NoError(t, svc.router.reconcile(t.Context()))

	for _, tc := range []struct {
		target string
		next   bool
		status int // not found, unless set
	}{
		{target: "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards"},
		{target: "/apis/dashboard.grafana.app"},
		{target: "/apis/Not_A.Group/v1/things", status: http.StatusBadRequest},
		{target: "/openapi/v3/apis/dashboard.grafana.app/v1"},
		{target: "/openapi/v3/apis/owned.grafana.app"},
		{target: "/api/dashboards/uid/abc", next: true},
	} {
		t.Run(tc.target, func(t *testing.T) {
			var called bool
			next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				called = true
				w.WriteHeader(http.StatusTeapot)
			})
			rec := httptest.NewRecorder()
			svc.HandleFunc(rec, newAuthenticatedRequest(http.MethodGet, tc.target, nil), next)
			require.Equal(t, tc.next, called)
			switch {
			case tc.next:
				require.Equal(t, http.StatusTeapot, rec.Code)
			case tc.status != 0:
				require.Equal(t, tc.status, rec.Code)
			default:
				require.Equal(t, http.StatusNotFound, rec.Code)
			}
		})
	}
}

// App plugin settings are only served by the router, so enabling them inside
// Grafana also enables the router middleware. The standalone router has no
// embedded API server, so no flag makes it middleware.
func TestMiddlewareEnabledBySettingsAPI(t *testing.T) {
	grafana := setting.NewCfg()
	standalone := setting.NewCfg()
	standalone.Target = []string{"router"}
	for _, tc := range []struct {
		name       string
		cfg        *setting.Cfg
		toggles    []any
		flags      []string // served by OpenFeature only
		middleware bool
		settings   bool
	}{
		{"no flags", grafana, nil, nil, false, false},
		{"router middleware", grafana, []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, nil, true, false},
		{"settings API", grafana, nil, []string{featuremgmt.FlagApppluginsRegisterAPIServer}, true, true},
		{"standalone router with the settings API", standalone, nil, []string{featuremgmt.FlagApppluginsRegisterAPIServer}, false, false},
		{"standalone router with router middleware", standalone, []any{featuremgmt.FlagGrafanaUseRouterMiddleware}, nil, false, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			featuremgmt.WithEnabledFlags(t, tc.flags...)
			features := featuremgmt.WithFeatures(tc.toggles...)
			require.Equal(t, tc.middleware, middlewareEnabled(tc.cfg, features))
			require.Equal(t, tc.settings, settingsEnabled(tc.cfg))
			svc, err := ProvideService(tc.cfg, features, dummyRoutesLoader{}, prometheus.NewRegistry(), NewGrafanaRouter(nil, nil))
			require.NoError(t, err)
			require.Equal(t, tc.middleware, svc.middleware)
		})
	}
	require.False(t, middlewareEnabled(grafana, nil))
	require.False(t, settingsEnabled(grafana))
}

// The router wire provides publishes the manifests compiled into Grafana for
// the groups it serves.
func TestProvideGrafanaRouterHasTheBuiltinManifests(t *testing.T) {
	r, err := ProvideGrafanaRouter(setting.NewCfg())
	require.NoError(t, err)
	manifests := resource.AppManifests()
	want := make([]string, 0, len(manifests))
	for _, m := range manifests {
		want = append(want, m.Group)
	}
	require.NotEmpty(t, want)
	require.ElementsMatch(t, want, slices.Collect(maps.Keys(r.builtinManifests)))
}
