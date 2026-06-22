package apiserver

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// capturedRoute records a single registered route so tests can assert both the pattern
// (which becomes the `handler` label in grafana_http_request_duration_seconds) and the
// middleware chain (which determines whether the route requires authentication).
type capturedRoute struct {
	method   string
	handlers []web.Handler
}

// captureRouter implements routing.Router and records every route registered against it.
type captureRouter struct {
	routes map[string]capturedRoute
}

var _ routing.Router = (*captureRouter)(nil)

func (r *captureRouter) Handle(method, pattern string, handlers []web.Handler) {
	r.routes[pattern] = capturedRoute{method: method, handlers: handlers}
}

func (r *captureRouter) Get(pattern string, handlers ...web.Handler) {
	r.routes[pattern] = capturedRoute{method: "GET", handlers: handlers}
}

func registerForTest(t *testing.T) *captureRouter {
	t.Helper()
	rr := routing.NewRouteRegister(middleware.ProvideRouteOperationName)
	rr.Group("/apis", func(k8sRoute routing.RouteRegister) {
		registerAPIServerRoutes(k8sRoute, func(*contextmodel.ReqContext) {})
	})

	cr := &captureRouter{routes: map[string]capturedRoute{}}
	rr.Register(cr)
	return cr
}

func TestRegisterAPIServerRoutes_PerResourcePatterns(t *testing.T) {
	cr := registerForTest(t)

	// Each resource needs its own explicit route pattern so it gets a distinct
	// `handler` label in grafana_http_request_duration_seconds instead of being merged
	// into the generic /apis/* bucket.
	for _, pattern := range []string{
		"/apis/features.grafana.app/v0alpha1/*",
		"/apis/dashboard.grafana.app/*",
		"/apis/folder.grafana.app/*",
		"/apis/*", // catch-all must still exist for every other group
	} {
		_, ok := cr.routes[pattern]
		require.True(t, ok, "expected route %q to be registered", pattern)
	}
}

func TestRegisterAPIServerRoutes_AuthIsPreserved(t *testing.T) {
	cr := registerForTest(t)

	// The named ProvideRouteOperationName middleware is prepended to every route, so an
	// unauthenticated route carries [routeName, handler] while an authenticated one
	// carries [routeName, ReqSignedIn, handler]. Comparing chain lengths guards that the
	// new dashboard/folder wildcards keep ReqSignedIn (matching the catch-all they used
	// to fall through), while the public snapshot routes stay unauthenticated.
	const unauthenticated = 2
	const authenticated = 3

	snapshot := "/apis/dashboard.grafana.app/v0alpha1/namespaces/:namespace/snapshots/:name"
	cases := []struct {
		pattern  string
		method   string
		handlers int
	}{
		{"/apis/dashboard.grafana.app/*", "*", authenticated},
		{"/apis/folder.grafana.app/*", "*", authenticated},
		{"/apis/*", "*", authenticated},
		{"/apis/features.grafana.app/v0alpha1/*", "*", unauthenticated},
		{snapshot, "GET", unauthenticated},
		{snapshot + "/dashboard", "GET", unauthenticated},
	}
	for _, tc := range cases {
		route, ok := cr.routes[tc.pattern]
		require.True(t, ok, "expected route %q to be registered", tc.pattern)
		require.Equal(t, tc.method, route.method, "unexpected method for %q", tc.pattern)
		require.Len(t, route.handlers, tc.handlers, "unexpected middleware chain for %q", tc.pattern)
	}
}
