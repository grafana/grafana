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
)

// contextMiddleware is a minimal version of contexthandler.Middleware. The page
// is served unauthenticated, so no user is resolved. The ReqContext is only
// there to hold the CSP nonce and the request logger.
func (s *swaggerService) contextMiddleware() web.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			next.ServeHTTP(w, r.WithContext(setRequestContext(r.Context(), w, r)))
		})
	}
}

func setRequestContext(ctx context.Context, w http.ResponseWriter, r *http.Request) context.Context {
	webCtx := web.FromContext(ctx)
	reqContext := &contextmodel.ReqContext{
		Context:      webCtx,
		Logger:       log.New("context"),
		SignedInUser: &user.SignedInUser{},
	}

	ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)

	// r and reqContext.Req point to the same value, so this updates both.
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
