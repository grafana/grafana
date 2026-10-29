package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
)

// recordingRouter is a RequestRouter that answers what it routes itself.
type recordingRouter struct {
	routed   int
	upstream http.Handler
}

func (r *recordingRouter) HandleFunc(w http.ResponseWriter, _ *http.Request, _ http.Handler) {
	r.routed++
	w.WriteHeader(http.StatusTeapot)
}

func (r *recordingRouter) SetUpstream(handler http.Handler) { r.upstream = handler }

func newRoutedTestService(t *testing.T, router RequestRouter) *service {
	t.Helper()
	s := &service{
		requestRouter: router,
		handler: http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}),
	}
	s.NamedService = services.NewIdleService(nil, nil)
	require.NoError(t, services.StartAndAwaitRunning(t.Context(), s))
	return s
}

// In-process requests from Grafana go through the router, as requests over
// HTTP do, so a group the router serves is the router's here too. Kubernetes'
// own loopback clients carry no Grafana requester, and go straight to the
// server.
func TestServeRoutedRoutesGrafanaRequests(t *testing.T) {
	router := &recordingRouter{}
	s := newRoutedTestService(t, router)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards", nil)
	s.serveRouted(rec, req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1})))
	require.Equal(t, http.StatusTeapot, rec.Code)

	rec = httptest.NewRecorder()
	s.serveRouted(rec, httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1/namespaces/default/dashboards", nil))
	require.Equal(t, http.StatusNoContent, rec.Code, "a loopback request without a requester is the server's")
	require.Equal(t, 1, router.routed)

	// Without a router, every request is the server's.
	s = newRoutedTestService(t, nil)
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1", nil)
	s.serveRouted(rec, req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1})))
	require.Equal(t, http.StatusNoContent, rec.Code)
}

func TestLoopbackHandlerRoutesGrafanaRequests(t *testing.T) {
	core := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusNoContent) })
	router := &recordingRouter{}
	h := (&service{requestRouter: router}).loopbackHandler(core)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis/example.ext.grafana.app/v1", nil)
	h.ServeHTTP(rec, req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1})))
	require.Equal(t, http.StatusTeapot, rec.Code)

	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/apis/example.ext.grafana.app/v1", nil))
	require.Equal(t, http.StatusNoContent, rec.Code)
	require.Equal(t, 1, router.routed)

	rec = httptest.NewRecorder()
	h = (&service{}).loopbackHandler(core)
	h.ServeHTTP(rec, req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1})))
	require.Equal(t, http.StatusNoContent, rec.Code)
}

// The legacy /api handlers reach the Kubernetes APIs through the direct rest
// config and DirectlyServeHTTP, which must go through the router.
func TestDirectClientsGoThroughTheRouter(t *testing.T) {
	router := &recordingRouter{}
	s := newRoutedTestService(t, router)

	cfg := s.GetDirectRestConfig(&contextmodel.ReqContext{SignedInUser: &user.SignedInUser{OrgID: 1}})
	resp, err := cfg.Transport.RoundTrip(httptest.NewRequest(http.MethodGet, "/apis/dashboard.grafana.app/v1", nil))
	require.NoError(t, err)
	require.NoError(t, resp.Body.Close())
	require.Equal(t, http.StatusTeapot, resp.StatusCode)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/apis/datasource.grafana.app/v1", nil)
	s.DirectlyServeHTTP(rec, req.WithContext(identity.WithRequester(req.Context(), &user.SignedInUser{OrgID: 1})))
	require.Equal(t, http.StatusTeapot, rec.Code)
	require.Equal(t, 2, router.routed)
}
