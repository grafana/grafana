package frontend

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// contextMiddleware creates a request context for frontend-service
// It sets up a basic authenticated context for service operations
func (s *frontendService) contextMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			reqContext := &contextmodel.ReqContext{
				Context: web.FromContext(ctx),
				Logger:  log.New("context"),
				// Create a service user for frontend operations
				// In a real implementation, you'd extract user from cookies/headers
				SignedInUser: &user.SignedInUser{
					UserID:      1,
					OrgID:       1,
					OrgRole:     org.RoleViewer, // Minimal permissions for short URL access
					Login:       "frontend-service",
					Name:        "Frontend Service",
					Email:       "frontend-service@grafana.local",
					Permissions: map[int64]map[string][]string{},
				},
				IsSignedIn:     true,
				AllowAnonymous: false,
			}

			// inject ReqContext in the context
			ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)

			// Set the context for the http.Request.Context
			// This modifies both r and reqContext.Req since they point to the same value
			*reqContext.Req = *reqContext.Req.WithContext(ctx)

			traceID := tracing.TraceIDFromContext(ctx, false)
			if traceID != "" {
				reqContext.Logger = reqContext.Logger.New("traceID", traceID)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
