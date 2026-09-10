package pluginrouter

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/router"
	"github.com/grafana/grafana/pkg/setting"
)

// A signed-in caller here runs as the service identity, with full access to
// every group served. That is a development posture, and the target refuses to
// run anywhere else rather than trusting a setting to be in the right place.
func TestProvideServiceOnlyRunsInDev(t *testing.T) {
	_, err := ProvideService(&setting.Cfg{Raw: ini.Empty(), Env: setting.Prod},
		nil, nil, nil, nil, mux.NewRouter(), nil, nil, PluginDeps{})
	require.ErrorContains(t, err, "only runs when app_mode is")
}

// The whole point of the module: a plugin on disk becomes a group the router
// advertises and serves, on the HTTP server this target already runs, without
// taking over the routes that server already has.
func TestServiceServesTheDiscoveredPlugins(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	httpRouter := mux.NewRouter()
	httpRouter.HandleFunc("/metrics", func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("metrics"))
	})

	loader := testLoader(t, "testdata/with-manifest")
	loader.opts.Authorizer = serviceIdentityAuthorizer()

	gate := testGate(t)
	gate.register(httpRouter)
	s := &Service{
		log:    log.New("plugin-router.test"),
		router: router.NewGrafanaRouter(loader),
		login:  gate,
	}
	s.registerRoutes(httpRouter)
	require.NoError(t, s.router.Run(ctx))
	require.Eventually(t, func() bool { return s.router.Ready(ctx) == nil },
		10*time.Second, 10*time.Millisecond, "router never became ready")

	// The groups are only served to a caller that signed in; that is what
	// TestServiceWithLogin is about, so this one signs in and moves on.
	session := sessionFrom(t, postLogin(httpRouter, "admin", "s3cret"))

	// /apis is synthesized by the router from each backend's manifest.
	res := serveAs(httpRouter, "/apis", session)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var groups metav1.APIGroupList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &groups))
	require.Len(t, groups.Groups, 1)
	require.Equal(t, "routerexample.ext.grafana.app", groups.Groups[0].Name)

	// And the group itself is served by the backend behind it, not synthesized.
	res = serveAs(httpRouter, "/apis/routerexample.ext.grafana.app/v1alpha1", session)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())
	var resources metav1.APIResourceList
	require.NoError(t, json.Unmarshal(res.Body.Bytes(), &resources))
	names := map[string]bool{}
	for _, r := range resources.APIResources {
		names[r.Name] = true
	}
	require.True(t, names["testkinds"], "the manifest kind is served: %v", names)

	// The OpenAPI document the router proxies to the owning backend.
	res = serveAs(httpRouter, "/openapi/v3/apis/routerexample.ext.grafana.app/v1alpha1", session)
	require.Equal(t, http.StatusOK, res.Code, res.Body.String())

	// A group nothing serves is answered by the router, not passed anywhere.
	require.Equal(t, http.StatusNotFound,
		serveAs(httpRouter, "/apis/nobody.ext.grafana.app/v1", session).Code)

	// Routes the shared server already had are untouched.
	res = serve(httpRouter, "/metrics")
	require.Equal(t, http.StatusOK, res.Code)
	require.Equal(t, "metrics", res.Body.String())
}

// The posture the login gate buys: the groups are closed to anyone who has not
// signed in, and open to the same session the form mints.
func TestServiceWithLogin(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	loader := testLoader(t, "testdata/with-manifest")
	loader.opts.Authorizer = serviceIdentityAuthorizer()

	httpRouter := mux.NewRouter()
	gate := testGate(t)
	gate.register(httpRouter)

	s := &Service{
		log:    log.New("plugin-router.test"),
		router: router.NewGrafanaRouter(loader),
		login:  gate,
	}
	s.registerRoutes(httpRouter)
	require.NoError(t, s.router.Run(ctx))
	require.Eventually(t, func() bool { return s.router.Ready(ctx) == nil },
		10*time.Second, 10*time.Millisecond, "router never became ready")

	group := "/apis/routerexample.ext.grafana.app/v1alpha1"

	t.Run("the root sends a caller to sign in first", func(t *testing.T) {
		res := serve(httpRouter, "/")
		require.Equal(t, http.StatusFound, res.Code)
		require.Equal(t, "/login", res.Header().Get("Location"))
	})

	t.Run("the group is closed before signing in", func(t *testing.T) {
		require.Equal(t, http.StatusUnauthorized, serve(httpRouter, group).Code)
	})

	t.Run("and open after", func(t *testing.T) {
		cookie := sessionFrom(t, postLogin(httpRouter, "admin", "s3cret"))

		res := serveAs(httpRouter, group, cookie)
		require.Equal(t, http.StatusOK, res.Code, res.Body.String())
		require.Contains(t, res.Body.String(), "testkinds")

		// And the root now goes where the caller actually wanted to be.
		require.Equal(t, "/swagger", serveAs(httpRouter, "/", cookie).Header().Get("Location"))
	})
}

// The module reports into the shared /readyz rather than answering one itself,
// and only once the router actually has a routing table.
func TestReportReady(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)

	notifier := &fakeNotifier{}
	s := &Service{
		log:    log.New("plugin-router.test"),
		router: router.NewGrafanaRouter(testLoader(t, "testdata/with-manifest")),
		ready:  notifier,
	}

	// Before the first reconcile there is nothing to serve.
	s.reportReady(ctx)
	require.False(t, notifier.ready)

	require.NoError(t, s.router.Run(ctx))
	require.Eventually(t, func() bool {
		s.reportReady(ctx)
		return notifier.ready
	}, 10*time.Second, 10*time.Millisecond, "readiness was never reported")

	require.NoError(t, s.stop(nil))
	require.False(t, notifier.ready, "shutdown must take the module out of rotation")
}

type fakeNotifier struct{ ready bool }

func (f *fakeNotifier) SetReady()    { f.ready = true }
func (f *fakeNotifier) SetNotReady() { f.ready = false }

func serve(handler http.Handler, path string) *httptest.ResponseRecorder {
	res := httptest.NewRecorder()
	handler.ServeHTTP(res, httptest.NewRequest(http.MethodGet, path, nil))
	return res
}

// serveAs makes the request as a caller that has signed in.
func serveAs(handler http.Handler, path string, session *http.Cookie) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req.AddCookie(session)

	res := httptest.NewRecorder()
	handler.ServeHTTP(res, req)
	return res
}
