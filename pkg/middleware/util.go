package middleware

import (
	"strings"

	"github.com/Unknwon/macaron"
)

func Gziper() macaron.Handler {
	macaronGziper := macaron.Gziper()

	return func(ctx *macaron.Context) {
		requestPath := ctx.Req.URL.RequestURI()
		// ignore datasource proxy requests
		if strings.HasPrefix(requestPath, "/api/datasources/proxy") {
			return
		}

		ctx.Invoke(macaronGziper)
	}
}
