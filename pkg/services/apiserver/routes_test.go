package apiserver

import (
	"net/http"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web/webtest"
)

type passthroughRouter struct{}

func (passthroughRouter) HandleFunc(w http.ResponseWriter, r *http.Request, next http.Handler) {
	next.ServeHTTP(w, r)
}

func (passthroughRouter) SetUpstream(http.Handler) {}

// Kubernetes probes call /livez and /readyz signed out. They must get the
// apiserver's own status, not a redirect to the login page.
func TestProbeRoutesAllowSignedOutGet(t *testing.T) {
	s := &service{
		rr:            routing.NewRouteRegister(),
		requestRouter: passthroughRouter{},
		handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusServiceUnavailable)
		}),
	}
	s.NamedService = services.NewIdleService(nil, nil)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), s))
	s.registerRoutes()

	server := webtest.NewServer(t, s.rr)
	server.HttpClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	send := func(method, target string) int {
		t.Helper()
		req := server.NewRequest(method, target, nil)
		req = webtest.RequestWithWebContext(req, &contextmodel.ReqContext{SignedInUser: &user.SignedInUser{}})
		resp, err := server.Send(req)
		require.NoError(t, err)
		require.NoError(t, resp.Body.Close())
		return resp.StatusCode
	}

	for _, target := range []string{"/livez", "/readyz", "/readyz?verbose"} {
		require.Equal(t, http.StatusServiceUnavailable, send(http.MethodGet, target), target)
	}

	// Everything else still needs a signed-in user.
	require.Equal(t, http.StatusFound, send(http.MethodPost, "/readyz"))
	require.Equal(t, http.StatusFound, send(http.MethodGet, "/readyz/etcd"))
	require.Equal(t, http.StatusFound, send(http.MethodGet, "/version"))
}
