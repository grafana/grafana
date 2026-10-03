package features

import (
	"context"

	"go.opentelemetry.io/otel/baggage"

	"github.com/open-feature/go-sdk/openfeature"
)

const (
	NamespaceKey = "namespace"
)

// unresolvedNamespaceValues are values that mean "nothing real was
// resolved" rather than a genuine tenant namespace: "" (never set),
// "*" (a wildcard/service-scoped identity, e.g. an access-policy with no
// single tenant), and "default" (the literal fallback string
// pkg/setting/setting_openfeature.go seeds as the global OpenFeature
// context for any service with no cfg.StackID - every shared MT service).
// Treated as equivalent everywhere a caller decides whether a namespace has
// already been resolved, so a value that only looks resolved because some
// upstream layer defaulted to one of these doesn't block a better one from
// being filled in.
var unresolvedNamespaceValues = map[string]bool{
	"":        true,
	"*":       true,
	"default": true,
}

func isUnresolvedNamespace(ns string) bool {
	return unresolvedNamespaceValues[ns]
}

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

// WithTransactionContextFromBaggage merges the eval context derived from OTel
// baggage into ctx as the OpenFeature transaction context. Shared by the HTTP
// middleware and the gRPC path so evaluation behaves the same on both.
func WithTransactionContextFromBaggage(ctx context.Context) context.Context {
	return openfeature.MergeTransactionContext(ctx, EvaluationContextFromBaggage(ctx))
}

// WithTransactionContextFallback fills in whichever of the targeting key and
// the "namespace" attribute on ctx's OpenFeature transaction context is
// still missing (e.g. because baggage from the HG gateway never arrived).
// The two are filled independently: if one is already set (by baggage, or
// by a hypothetical setter that only sets one of them) it is used to fill
// the other, so they never end up disagreeing; only when both are missing
// does ns (the caller's own best-effort derived namespace) get used.
// Callers that reach an MT service directly - service-to-service, never
// proxied through the gateway that injects baggage - have no baggage to
// derive a namespace from; this lets them supply one from whatever ambient
// identity they do have instead of silently evaluating flags against
// "default".
func WithTransactionContextFallback(ctx context.Context, ns string) context.Context {
	existing := openfeature.TransactionContext(ctx)
	existingTargetingKey := existing.TargetingKey()
	existingNs, _ := existing.Attribute(NamespaceKey).(string)

	fill := existingTargetingKey
	if isUnresolvedNamespace(fill) {
		fill = existingNs
	}
	if isUnresolvedNamespace(fill) {
		fill = ns
	}
	if isUnresolvedNamespace(fill) {
		return ctx
	}

	attrs := map[string]any{}
	if isUnresolvedNamespace(existingNs) {
		attrs[NamespaceKey] = fill
	}
	targetingKey := ""
	if isUnresolvedNamespace(existingTargetingKey) {
		targetingKey = fill
	}
	if targetingKey == "" && len(attrs) == 0 {
		return ctx
	}

	return openfeature.MergeTransactionContext(ctx, openfeature.NewEvaluationContext(targetingKey, attrs))
}
