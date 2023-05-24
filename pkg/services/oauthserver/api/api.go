package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type api struct {
	router      routing.RouteRegister
	oauthServer oauthserver.OAuth2Server
}

func NewAPI(
	router routing.RouteRegister,
	oauthServer oauthserver.OAuth2Server,
) *api {
	return &api{
		router:      router,
		oauthServer: oauthServer,
	}
}

func (a *api) RegisterAPIEndpoints() {
	a.router.Group("/oauth2", func(oauthRouter routing.RouteRegister) {
		oauthRouter.Post("/introspect", a.handleIntrospectionRequest)
		oauthRouter.Post("/token", a.handleTokenRequest)
	})
}

func (a *api) handleTokenRequest(c *contextmodel.ReqContext) {
	a.oauthServer.HandleTokenRequest(c.Resp, c.Req)
}

func (a *api) handleIntrospectionRequest(c *contextmodel.ReqContext) {
	a.oauthServer.HandleIntrospectionRequest(c.Resp, c.Req)
}
