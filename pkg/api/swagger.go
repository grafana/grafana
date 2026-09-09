package api

import (
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/services/swagger"
)

// registerSwaggerUI mounts the swagger service's handler on the core HTTP server.
// The same routes are served standalone by the swagger-server target.
func (hs *HTTPServer) registerSwaggerUI(r routing.RouteRegister) {
	handler := swagger.NewHandler(hs.Cfg, hs.License)

	// Deprecated
	r.Get("/swagger-ui", swagger.HandleRedirect)
	// Deprecated
	r.Get("/openapi3", swagger.HandleRedirect)

	// The swagger based api navigator
	r.Get("/swagger", handler.HandleRequest)
}
