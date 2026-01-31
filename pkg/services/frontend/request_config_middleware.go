package frontend

import (
	"net/http"

	"github.com/grafana/grafana/pkg/web"
)

func RequestConfigMiddleware(baseConfig FSRequestConfig) web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// TODO: In the future fetch and override request-specific config here
			finalConfig := baseConfig

			// Store config in context
			ctx := finalConfig.WithContext(r.Context())

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
