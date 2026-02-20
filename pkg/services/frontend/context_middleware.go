package frontend

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/open-feature/go-sdk/openfeature"
	"k8s.io/apiserver/pkg/endpoints/request"

	"go.opentelemetry.io/otel/baggage"
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

	// inject ReqContext in the context
	ctx = context.WithValue(ctx, ctxkey.Key{}, reqContext)

	// Set the context for the http.Request.Context
	// This modifies both r and reqContext.Req since they point to the same value
	if webCtx != nil {
		*reqContext.Req = *reqContext.Req.WithContext(ctx)
	}

	// add traceID to logger context
	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		reqContext.Logger = reqContext.Logger.New("traceID", traceID)
		// set trace ID in response headers as well
		w.Header().Set("Trace-ID", traceID)
	}

	// add hostname to logger context
	hostname := r.Host
	if hostname != "" {
		reqContext.Logger = reqContext.Logger.New("hostname", hostname)
	}

	// Parse namespace from W3C baggage header
	var namespace string
	if baggageHeader := r.Header.Get("baggage"); baggageHeader != "" {
		if bag, err := baggage.Parse(baggageHeader); err == nil {
			if member := bag.Member("namespace"); member.Value() != "" {
				namespace = member.Value()
			}
		}
	}
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}

	// Note: OpenFeature is already initialized by target.go before this service starts.
	// The frontend service only needs to set evaluation context per request
	openFeatureNamespace := "default"
	if namespace != "" {
		openFeatureNamespace = namespace
	}
	evalCtx := openfeature.NewEvaluationContext(openFeatureNamespace, map[string]any{
		"namespace": openFeatureNamespace,
		"hostname":  hostname,
	})
	ctx = openfeature.MergeTransactionContext(ctx, evalCtx)

	return ctx
}
