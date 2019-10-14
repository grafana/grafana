package middleware

import (
	"strings"

	"github.com/go-macaron/gzip"
	m "github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

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
			if ctx, ok := ctx.Data["ctx"]; ok {
				ctxTyped := ctx.(*m.ReqContext)
				ctxTyped.Logger.Debug("Invoking gzip handler failed", "err", err)
			}
		}
	}
}
