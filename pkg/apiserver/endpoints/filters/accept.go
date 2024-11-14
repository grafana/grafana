package filters

import (
	"net/http"

	"github.com/grafana/grafana/pkg/apiserver/endpoints/request"
)

// WithAcceptHeader adds the Accept header to the request context.
func WithAcceptHeader(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx := request.WithAcceptHeader(req.Context(), req.Header.Get("Accept"))
		handler.ServeHTTP(w, req.WithContext(ctx))
	})
}
