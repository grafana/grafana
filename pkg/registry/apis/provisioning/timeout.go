package provisioning

import (
	"context"
	"net/http"
	"time"

	"k8s.io/apiserver/pkg/endpoints/request"
)

// CtxHandlerFunc is a request handler that receives the timeout-bounded
// context as an explicit first parameter. Pass this to WithTimeout /
// WithTimeoutFunc so backend calls inside the handler use the bounded ctx
// instead of an outer-scope one captured by closure.
type CtxHandlerFunc func(ctx context.Context, w http.ResponseWriter, r *http.Request)

func WithTimeout(ctx context.Context, f CtxHandlerFunc, timeout time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqCtx := r.Context()
		if ns, ok := request.NamespaceFrom(ctx); ok {
			reqCtx = request.WithNamespace(reqCtx, ns)
		}

		ctxWithTimeout, cancel := context.WithTimeout(reqCtx, timeout)
		defer cancel()
		f(ctxWithTimeout, w, r.WithContext(ctxWithTimeout))
	})
}

// WithTimeoutFunc adds a timeout context to the request
func WithTimeoutFunc(f CtxHandlerFunc, timeout time.Duration) http.HandlerFunc {
	return WithTimeout(context.Background(), f, timeout).ServeHTTP
}
