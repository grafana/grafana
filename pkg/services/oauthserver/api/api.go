package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type api struct {
	router       routing.RouteRegister
	oauthService oauthserver.OAuth2Service
}

func NewAPI(
	router routing.RouteRegister,
	oauthService oauthserver.OAuth2Service,
) *api {
	return &api{
		router:       router,
		oauthService: oauthService,
	}
}

func (a *api) RegisterAPIEndpoints() {
	// authorize := ac.Middleware(a.ac)
	a.router.Group("/oauth2", func(oauthRouter routing.RouteRegister) {
		// oauthRouter.Get("/clients/", middleware.ReqGrafanaAdmin, a.getClients)
		// oauthRouter.Get("/client/:id", middleware.ReqGrafanaAdmin, a.getClient)
		// oauthRouter.Delete("/client/:id", middleware.ReqGrafanaAdmin, a.removeClient)

		// TODO: protect register endpoint
		oauthRouter.Post("/introspect", a.handleIntrospectionRequest)
		oauthRouter.Post("/token", a.handleTokenRequest)
	})
}

func (a *api) handleTokenRequest(c *contextmodel.ReqContext) {
	a.oauthService.HandleTokenRequest(c.Resp, c.Req)
}

func (a *api) handleIntrospectionRequest(c *contextmodel.ReqContext) {
	a.oauthService.HandleIntrospectionRequest(c.Resp, c.Req)
}
