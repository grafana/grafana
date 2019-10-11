package middleware

import (
	"log"
	"strings"

	"github.com/go-macaron/gzip"
	"gopkg.in/macaron.v1"
)

func Gziper() macaron.Handler {
	gziper := gzip.Gziper()

	return func(ctx *macaron.Context, logger *log.Logger) {
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
			logger.Printf("Invoking gzip handler failed: %s\n", err)
		}
	}
}
