package features

import (
	"net/http"

	"github.com/open-feature/go-sdk/openfeature"
)

// WithTransactionContextMiddleware is an HTTP middleware that reads OTel baggage
// from the incoming request and sets it as the OpenFeature transaction context.
// Register it in each MT service's HTTP middleware chain.
func WithTransactionContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		evalCtx := EvaluationContextFromBaggage(r.Context())
		ctx := openfeature.MergeTransactionContext(r.Context(), evalCtx)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
