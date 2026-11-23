package apiserver

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"

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

func TestRegisterRawRoutes(t *testing.T) {
	rr := routing.NewRouteRegister()
	var err error
	rr.Group("/apis", func(apis routing.RouteRegister) {
		err = registerRawRoutes(apis, []rawroutes.Route{
			{Group: "live.grafana.app", Version: "v1alpha1", Method: http.MethodGet, Path: "ws"},
			{Group: "live.grafana.app", Version: "v1alpha1", Method: http.MethodPost, Path: "push"},
		})
	})
	require.NoError(t, err)

	router := &capturingRouter{}
	rr.Register(router)
	require.Equal(t, []string{
		"GET /apis/live.grafana.app/v1alpha1/namespaces/:namespace/ws",
		"POST /apis/live.grafana.app/v1alpha1/namespaces/:namespace/push",
	}, router.routes)

	err = registerRawRoutes(routing.NewRouteRegister(), []rawroutes.Route{
		{Group: "live.grafana.app", Version: "v1alpha1", Method: http.MethodDelete, Path: "ws"},
	})
	require.Error(t, err)
}

func TestRawRouteHandler(t *testing.T) {
	signedIn := &user.SignedInUser{UserID: 1, UserUID: "u1", OrgID: 1, Namespace: "default"}

	var gotNamespace string
	var gotUser identity.Requester
	h := rawRouteHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotNamespace = r.PathValue("namespace")
		gotUser, _ = identity.GetRequester(r.Context())
		w.WriteHeader(http.StatusSwitchingProtocols)
	})).(func(*contextmodel.ReqContext))

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
