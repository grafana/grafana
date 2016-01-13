package middleware

import (
	"strings"

	"gopkg.in/macaron.v1"
	"github.com/go-macaron/gzip"
)

func Gziper() macaron.Handler {
	macaronGziper := gzip.Gziper()

	return func(ctx *macaron.Context) {
		requestPath := ctx.Req.URL.RequestURI()
		// ignore datasource proxy requests
		if strings.HasPrefix(requestPath, "/api/datasources/proxy") {
			return
		}

		ctx.Invoke(macaronGziper)
	}
}
