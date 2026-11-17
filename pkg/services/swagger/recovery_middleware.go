package swagger

import (
	"net/http"
	"runtime/debug"

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/web"
)

// recoveryMiddleware turns a panic into a 500 instead of a dropped connection.
//
// middleware.Recovery is not used here because it renders its error page through
// the template set that web.Renderer installs, which this service does not have.
func (s *swaggerService) recoveryMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				rec := recover()
				if rec == nil {
					return
				}

				logger := s.log
				if reqCtx := contexthandler.FromContext(r.Context()); reqCtx != nil {
					logger = reqCtx.Logger
				}
				logger.Error("Request error", "error", rec, "stack", string(debug.Stack()))

				// A partially rendered response can't be replaced with an error.
				if webCtx := web.FromContext(r.Context()); webCtx != nil && webCtx.Resp.Written() {
					return
				}
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}()

			next.ServeHTTP(w, r)
		})
	}
}
