package features

import (
	"context"

	"go.opentelemetry.io/otel/baggage"

	"github.com/open-feature/go-sdk/openfeature"
)

const (
	NamespaceKey = "namespace"
)

// EvaluationContextFromBaggage extracts per-tenant attributes from OTel baggage
// and injects them into an OpenFeature evaluation context. The HG gateway
// populates these baggage members on every proxied request, so MT services get
// a full per-tenant eval context with no extra metadata API calls. namespace is
// used as the targeting key.
func EvaluationContextFromBaggage(ctx context.Context) openfeature.EvaluationContext {
	bag := baggage.FromContext(ctx)

	contextAtributes := map[string]any{}

	for _, member := range bag.Members() {
		contextAtributes[member.Key()] = member.Value()
	}

	targetingKey := bag.Member(NamespaceKey).Value()
	return openfeature.NewEvaluationContext(targetingKey, contextAtributes)
}

// EvaluationContextFromTargetingKey builds an evaluation context with no
// attributes, using targetingKey as the sole subject identifier.
func EvaluationContextFromTargetingKey(targetingKey string) openfeature.EvaluationContext {
	return openfeature.NewEvaluationContext(targetingKey, make(map[string]any))
}
