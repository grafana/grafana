package swagger

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/web"

	"go.opentelemetry.io/otel/trace"
)

// Minimal copy of contextHandler.Middleware for the swagger service.
// The swagger page is served unauthenticated, so no signed in user is resolved
// here; the ReqContext exists only so the CSP middleware has somewhere to put
// the per-request nonce.
func (s *swaggerService) contextMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()

			span := trace.SpanFromContext(ctx)
			ctx = setRequestContext(ctx, w, r)

			// Preserve the original span so the setRequestContext span doesn't get propagated as a parent of the rest of the request
			ctx = trace.ContextWithSpan(ctx, span)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func setRequestContext(ctx context.Context, w http.ResponseWriter, r *http.Request) context.Context {
	ctx, span := tracing.Start(ctx, "setRequestContext")
	defer span.End()

	webCtx := web.FromContext(ctx)
	reqContext := &contextmodel.ReqContext{
		Context:      webCtx,
		Logger:       log.New("context"),
		SignedInUser: &user.SignedInUser{},
	}

	ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)

	// This modifies both r and reqContext.Req since they point to the same value
	if webCtx != nil {
		*reqContext.Req = *reqContext.Req.WithContext(ctx)
	}

	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		reqContext.Logger = reqContext.Logger.New("traceID", traceID)
		w.Header().Set("Trace-ID", traceID)
	}

	if hostname := r.Host; hostname != "" {
		reqContext.Logger = reqContext.Logger.New("hostname", hostname)
	}

	if userAgent := r.UserAgent(); userAgent != "" {
		reqContext.Logger = reqContext.Logger.New("user_agent", userAgent)
	}

	return ctx
}
