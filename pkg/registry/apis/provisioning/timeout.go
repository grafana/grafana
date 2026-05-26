package provisioning

import (
	"context"
	"net/http"
	"time"
)

// CtxHandlerFunc is a request handler that receives the timeout-bounded
// context as an explicit first parameter. Pass this to WithTimeout /
// WithTimeoutFunc so backend calls inside the handler use the bounded ctx
// instead of an outer-scope one captured by closure.
type CtxHandlerFunc func(ctx context.Context, w http.ResponseWriter, r *http.Request)

func WithTimeout(f CtxHandlerFunc, timeout time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		f(ctx, w, r.WithContext(ctx))
	})
}

// WithTimeoutFunc adds a timeout context to the request
func WithTimeoutFunc(f CtxHandlerFunc, timeout time.Duration) http.HandlerFunc {
	return WithTimeout(f, timeout).ServeHTTP
}
