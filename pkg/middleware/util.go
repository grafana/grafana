package middleware

import (
	"strings"

	"github.com/go-macaron/gzip"
	"github.com/grafana/grafana/pkg/infra/log"
	"gopkg.in/macaron.v1"
)

var gziperLogger log.Logger = log.New("gziper")

func Gziper() macaron.Handler {
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

		if _, err := ctx.Invoke(gziper); err != nil {
			gziperLogger.Debug("Invoking gzip handler failed", "err", err)
		}
	}
}
