package api

import (
	"net/http"
	"strings"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

func openapi3(c *contextmodel.ReqContext) {
	data := map[string]interface{}{
		"Nonce": c.RequestNonce,
	}

	// Add CSP for unpkg.com to allow loading of Swagger UI assets
	if existingCSP := c.Resp.Header().Get("Content-Security-Policy"); existingCSP != "" {
		newCSP := strings.Replace(existingCSP, "style-src", "style-src https://unpkg.com/", 1)
		c.Resp.Header().Set("Content-Security-Policy", newCSP)
	}

	c.HTML(http.StatusOK, "openapi3", data)
}
