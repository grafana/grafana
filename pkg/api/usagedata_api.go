package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
)

func (hs *HTTPServer) registerUsagedataRoutes() {
	reqGrafanaAdmin := middleware.ReqGrafanaAdmin

	r := hs.RouteRegister

	r.Group("/api", func(userPersonaRoute routing.RouteRegister) {
		userPersonaRoute.Get("/usagedata", routing.Wrap(hs.Usagedata))
	}, reqGrafanaAdmin)
}
