package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apiserver/rawroutes"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

type capturingRouter struct {
	routes []string
}

func (r *capturingRouter) Handle(method, pattern string, _ []web.Handler) {
	r.routes = append(r.routes, method+" "+pattern)
}

func (r *capturingRouter) Get(pattern string, _ ...web.Handler) {
	r.routes = append(r.routes, http.MethodGet+" "+pattern)
}

var liveGV = schema.GroupVersion{Group: "live.grafana.app", Version: "v1alpha1"}

func TestRegisterRawRoutes(t *testing.T) {
	h := http.NotFoundHandler()

	rr := routing.NewRouteRegister()
	var err error
	rr.Group("/apis", func(apis routing.RouteRegister) {
		err = registerRawRoutes(apis, []rawroutes.Route{
			{API: liveGV, Namespaced: true, Method: http.MethodGet, Path: "ws", Handler: h},
			{API: liveGV, Namespaced: true, Method: http.MethodPost, Path: "push", Handler: h},
			{API: liveGV, Method: http.MethodGet, Path: "status", Handler: h},
		})
	})
	require.NoError(t, err)

	router := &capturingRouter{}
	rr.Register(router)
	require.Equal(t, []string{
		"GET /apis/live.grafana.app/v1alpha1/namespaces/:namespace/ws",
		"POST /apis/live.grafana.app/v1alpha1/namespaces/:namespace/push",
		"GET /apis/live.grafana.app/v1alpha1/status",
	}, router.routes)

	invalid := []struct {
		name   string
		routes []rawroutes.Route
	}{
		{name: "unsupported method", routes: []rawroutes.Route{{API: liveGV, Method: http.MethodDelete, Path: "ws", Handler: h}}},
		{name: "missing version", routes: []rawroutes.Route{{API: schema.GroupVersion{Group: "live.grafana.app"}, Method: http.MethodGet, Path: "ws", Handler: h}}},
		{name: "empty path", routes: []rawroutes.Route{{API: liveGV, Method: http.MethodGet, Handler: h}}},
		{name: "absolute path", routes: []rawroutes.Route{{API: liveGV, Method: http.MethodGet, Path: "/ws", Handler: h}}},
		{name: "missing handler", routes: []rawroutes.Route{{API: liveGV, Method: http.MethodGet, Path: "ws"}}},
		{name: "duplicate", routes: []rawroutes.Route{
			{API: liveGV, Namespaced: true, Method: http.MethodGet, Path: "ws", Handler: h},
			{API: liveGV, Namespaced: true, Method: http.MethodGet, Path: "ws", Handler: h},
		}},
	}
	for _, tt := range invalid {
		t.Run(tt.name, func(t *testing.T) {
			require.Error(t, registerRawRoutes(routing.NewRouteRegister(), tt.routes))
		})
	}
}

func TestRawRouteHandler(t *testing.T) {
	signedIn := &user.SignedInUser{UserID: 1, UserUID: "u1", OrgID: 1, Namespace: "default"}

	var gotNamespace string
	var gotUser identity.Requester
	h := rawRouteHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotNamespace = r.PathValue("namespace")
		gotUser, _ = identity.GetRequester(r.Context())
		w.WriteHeader(http.StatusSwitchingProtocols)
	}), true).(func(*contextmodel.ReqContext))

	req := httptest.NewRequest(http.MethodGet, "/apis/live.grafana.app/v1alpha1/namespaces/default/ws", nil)
	req = web.SetURLParams(req, map[string]string{":namespace": "default"})
	rec := httptest.NewRecorder()
	h(&contextmodel.ReqContext{
		Context:      &web.Context{Req: req, Resp: web.NewResponseWriter(http.MethodGet, rec)},
		SignedInUser: signedIn,
	})

	require.Equal(t, http.StatusSwitchingProtocols, rec.Code)
	require.Equal(t, "default", gotNamespace)
	require.Equal(t, signedIn, gotUser)
}
