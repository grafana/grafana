package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
)

func (hs *HTTPServer) registerPerconaRoutes() {
	reqSignedIn := middleware.ReqSignedIn
	reqSignedInNoAnonymous := middleware.ReqSignedInNoAnonymous

	r := hs.RouteRegister

	r.Group("/percona-api", func(apiRoute routing.RouteRegister) {
		apiRoute.Group("/user", func(userRoute routing.RouteRegister) {
			userRoute.Get("/oauth-token", routing.Wrap(hs.GetUserOAuthToken))
		}, reqSignedInNoAnonymous)
		apiRoute.Get("/saas-host", routing.Wrap(GetPerconaSaasHost))
	}, reqSignedIn)
}
