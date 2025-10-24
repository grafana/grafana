package frontend

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"
)

// Minimal copy of contextHandler.Middleware for frontend-service
// frontend-service doesn't handle authentication or know what signed in users are
func (s *frontendService) contextMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			span := trace.SpanFromContext(ctx)
			ctx = setRequestContext(ctx)

			// Preserve the original span so the setRequestContext span doesn't get propagated as a parent of the rest of the request
			ctx = trace.ContextWithSpan(ctx, span)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func setRequestContext(ctx context.Context) context.Context {
	ctx, span := tracing.Start(ctx, "setRequestContext")
	defer span.End()

	reqContext := &contextmodel.ReqContext{
		Context:      web.FromContext(ctx),
		Logger:       log.New("context"),
		SignedInUser: &user.SignedInUser{},
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

	return ctx
}
