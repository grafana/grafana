package middleware

import (
	"strings"

	"github.com/go-macaron/gzip"
	"gopkg.in/macaron.v1"
)

const resourcesPath = "/resources"

func (s *MiddlewareService) Gzipper() macaron.Handler {
	gzipper := gzip.Gziper()

	return func(ctx *macaron.Context) {
		requestPath := ctx.Req.URL.RequestURI()
		// ignore datasource proxy requests
		if strings.HasPrefix(requestPath, "/api/datasources/proxy") {
			return
		}

		if strings.HasPrefix(requestPath, "/api/plugin-proxy/") {
			return
		}

		if strings.HasPrefix(requestPath, "/metrics") {
			return
		}

		// ignore resources
		if (strings.HasPrefix(requestPath, "/api/datasources/") || strings.HasPrefix(requestPath, "/api/plugins/")) &&
			strings.Contains(requestPath, resourcesPath) {
			return
		}

		if _, err := ctx.Invoke(gzipper); err != nil {
			s.logger.Error("Invoking gzip handler failed", "err", err)
		}
	}
}
