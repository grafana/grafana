package middleware

import (
	"strings"

	"github.com/go-macaron/gzip"
	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/macaron.v1"
)

const resourcesPath = "/resources"

var gzipIgnoredPathPrefixes = []string{
	"/api/datasources/proxy", // Ignore datasource proxy requests.
	"/api/plugin-proxy/",
	"/metrics",
	"/live/ws", // WebSocket does not support gzip compression.
}

func Gziper() macaron.Handler {
	gziperLogger := log.New("gziper")
	gziper := gzip.Gziper()

	return func(ctx *macaron.Context) {
		requestPath := ctx.Req.URL.RequestURI()

		for _, pathPrefix := range gzipIgnoredPathPrefixes {
			if strings.HasPrefix(requestPath, pathPrefix) {
				return
			}
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
