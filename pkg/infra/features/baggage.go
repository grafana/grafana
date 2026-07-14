package features

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel/baggage"

	"github.com/open-feature/go-sdk/openfeature"
)

const (
	SlugKey      = "slug"
	PlanKey      = "plan"
	ChannelKey   = "channel"
	NamespaceKey = "namespace"
)

// InstanceContextFromBaggage extracts per-tenant attributes from OTel baggage
// and injects them into an OpenFeature evaluation context. The HG gateway
// populates these baggage members on every proxied request, so MT services get
// a full per-tenant eval context with no extra metadata API calls. namespace is
// used as the targeting key.
func InstanceContextFromBaggage(ctx context.Context) openfeature.EvaluationContext {
	bag := baggage.FromContext(ctx)

	contextAtributes := map[string]any{}

	set := func(attrKey string) {
		if v := bag.Member(attrKey).Value(); v != "" {
			contextAtributes[attrKey] = v
		}
	}

	set(SlugKey)
	set(PlanKey)
	set(ChannelKey)
	set(NamespaceKey)

	targetingKey := bag.Member(NamespaceKey).Value()
	return openfeature.NewEvaluationContext(targetingKey, contextAtributes)
}

// WithTransactionContextMiddleware is an HTTP middleware that reads OTel baggage
// from the incoming request and sets it as the OpenFeature transaction context.
// Register it in each MT service's HTTP middleware chain.
func WithTransactionContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		evalCtx := InstanceContextFromBaggage(r.Context())
		ctx := openfeature.MergeTransactionContext(r.Context(), evalCtx)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
