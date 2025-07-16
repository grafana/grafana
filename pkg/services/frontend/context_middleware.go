package frontend

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

// Minimal copy of contextHandler.Middleware for frontend-service
// frontend-service doesn't handle authentication or know what signed in users are
func (s *frontendService) contextMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			// Don't modify context so that the middleware span doesn't get propagated as a parent elsewhere
			_, span := tracer.Start(ctx, "Context middleware")

			reqContext := &contextmodel.ReqContext{
				Context: web.FromContext(ctx),
				Logger:  log.New("context"),
			}

			// inject ReqContext in the context
			ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)
			// Set the context for the http.Request.Context
			// This modifies both r and reqContext.Req since they point to the same value
			*reqContext.Req = *reqContext.Req.WithContext(ctx)

			ctx = trace.ContextWithSpan(reqContext.Req.Context(), span)
			traceID := tracing.TraceIDFromContext(ctx, false)
			if traceID != "" {
				reqContext.Logger = reqContext.Logger.New("traceID", traceID)
			}

			span.AddEvent("request")

			// End the span to make next handlers not wrapped within middleware span
			span.End()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
