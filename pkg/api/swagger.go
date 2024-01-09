package api

import (
	"net/http"
	"strings"

	"github.com/grafana/grafana/pkg/api/routing"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func registerSwaggerUI(r routing.RouteRegister) {
	// Deprecated
	r.Get("/swagger-ui", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "swagger", http.StatusMovedPermanently)
	})
	// Deprecated
	r.Get("/openapi3", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "swagger?show=v3", http.StatusMovedPermanently)
	})

	r.Get("/swagger", func(c *contextmodel.ReqContext) {
		data := map[string]any{
			"Nonce": c.RequestNonce,
		}

		// Add CSP for unpkg.com to allow loading of Swagger UI assets
		if existingCSP := c.Resp.Header().Get("Content-Security-Policy"); existingCSP != "" {
			newCSP := strings.Replace(existingCSP, "style-src", "style-src https://unpkg.com/", 1)
			c.Resp.Header().Set("Content-Security-Policy", newCSP)
		}

		c.HTML(http.StatusOK, "swagger", data)
	})
}
