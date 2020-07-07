package middleware

import (
	"strings"

	"github.com/go-macaron/gzip"
	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/macaron.v1"
)

const resourcesPath = "/resources"

func Gziper() macaron.Handler {
	gziperLogger := log.New("gziper")
	gziper := gzip.Gziper()

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
		if (strings.HasPrefix(requestPath, "/api/datasources/") || strings.HasPrefix(requestPath, "/api/plugins/")) && strings.Contains(requestPath, resourcesPath) {
			return
		}

		if _, err := ctx.Invoke(gziper); err != nil {
			gziperLogger.Error("Invoking gzip handler failed", "err", err)
		}
	}
}
