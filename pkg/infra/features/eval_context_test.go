package features

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/baggage"
)

func baggageCtx(t *testing.T, members string) *http.Request {
	t.Helper()
	bag, err := baggage.Parse(members)
	require.NoError(t, err)
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	return req.WithContext(baggage.ContextWithBaggage(req.Context(), bag))
}

func TestEvaluationContextFromBaggage(t *testing.T) {
	t.Run("empty context returns empty eval context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		evalCtx := EvaluationContextFromBaggage(req.Context())

		assert.Empty(t, evalCtx.TargetingKey())
		assert.Empty(t, evalCtx.Attributes())
	})

	t.Run("all canonical fields are extracted", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,plan=pro,channel=stable,namespace=stacks-42")
		evalCtx := EvaluationContextFromBaggage(req.Context())

		attrs := evalCtx.Attributes()
		assert.Equal(t, "mystack", attrs["slug"])
		assert.Equal(t, "pro", attrs["plan"])
		assert.Equal(t, "stable", attrs["channel"])
		assert.Equal(t, "stacks-42", attrs["namespace"])
	})

	t.Run("absent fields are not added to attributes", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,namespace=stacks-42")

		evalCtx := EvaluationContextFromBaggage(req.Context())
		assert.Equal(t, "stacks-42", evalCtx.TargetingKey())

		attrs := evalCtx.Attributes()
		assert.Contains(t, attrs, "slug")
		assert.Contains(t, attrs, "namespace")
		assert.NotContains(t, attrs, "plan")
		assert.NotContains(t, attrs, "channel")
	})

	t.Run("missing namespace results in empty targeting key", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,plan=pro")
		evalCtx := EvaluationContextFromBaggage(req.Context())

		assert.Empty(t, evalCtx.TargetingKey())
		assert.Equal(t, "mystack", evalCtx.Attributes()["slug"])
	})
}

func TestEvaluationContextFromTargetingKey(t *testing.T) {
	evalCtx := EvaluationContextFromTargetingKey("stacks-42")

	assert.Equal(t, "stacks-42", evalCtx.TargetingKey())
	assert.Empty(t, evalCtx.Attributes())
}

func TestWithTransactionContextFallback(t *testing.T) {
	t.Run("empty namespace leaves ctx untouched", func(t *testing.T) {
		ctx := WithTransactionContextFallback(context.Background(), "")

		tctx := openfeature.TransactionContext(ctx)
		assert.Empty(t, tctx.TargetingKey())
	})

	t.Run("sets namespace when nothing already set one", func(t *testing.T) {
		ctx := WithTransactionContextFallback(context.Background(), "stacks-42")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-42", tctx.TargetingKey())
		assert.Equal(t, "stacks-42", tctx.Attributes()["namespace"])
	})

	t.Run("does not override an existing targeting key, e.g. from baggage", func(t *testing.T) {
		existing := openfeature.NewEvaluationContext("stacks-1", map[string]any{"slug": "mystack"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-999")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-1", tctx.TargetingKey())
		assert.Equal(t, "mystack", tctx.Attributes()["slug"])
	})

	t.Run("does not override an existing namespace attribute even without a targeting key", func(t *testing.T) {
		existing := openfeature.NewTargetlessEvaluationContext(map[string]any{NamespaceKey: "stacks-1"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-999")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-1", tctx.Attributes()["namespace"])
	})

	t.Run("existing targeting key with no namespace attribute: fills the attribute from the targeting key, not ns", func(t *testing.T) {
		existing := openfeature.NewEvaluationContext("stacks-1", map[string]any{"slug": "mystack"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-999")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-1", tctx.TargetingKey())
		assert.Equal(t, "stacks-1", tctx.Attributes()["namespace"], "namespace attribute should match the existing targeting key, not the freshly-derived ns")
	})

	t.Run("existing namespace attribute with no targeting key: fills the targeting key from the attribute, not ns", func(t *testing.T) {
		existing := openfeature.NewTargetlessEvaluationContext(map[string]any{NamespaceKey: "stacks-1"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-999")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-1", tctx.TargetingKey(), "targeting key should be filled from the existing namespace attribute, not the freshly-derived ns")
		assert.Equal(t, "stacks-1", tctx.Attributes()["namespace"])
	})

	t.Run("both already set to the same value: no-op", func(t *testing.T) {
		existing := openfeature.NewEvaluationContext("stacks-1", map[string]any{NamespaceKey: "stacks-1"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-999")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-1", tctx.TargetingKey())
		assert.Equal(t, "stacks-1", tctx.Attributes()["namespace"])
	})

	t.Run("existing 'default' sentinel is treated as unresolved and overridden", func(t *testing.T) {
		existing := openfeature.NewEvaluationContext("default", map[string]any{NamespaceKey: "default"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-42")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-42", tctx.TargetingKey(), "'default' is a fallback sentinel (pkg/setting/setting_openfeature.go), not a real namespace")
		assert.Equal(t, "stacks-42", tctx.Attributes()["namespace"])
	})

	t.Run("existing '*' wildcard sentinel is treated as unresolved and overridden", func(t *testing.T) {
		existing := openfeature.NewEvaluationContext("*", map[string]any{NamespaceKey: "*"})
		ctx := openfeature.WithTransactionContext(context.Background(), existing)

		ctx = WithTransactionContextFallback(ctx, "stacks-42")

		tctx := openfeature.TransactionContext(ctx)
		assert.Equal(t, "stacks-42", tctx.TargetingKey(), "'*' is a wildcard/service-scoped identity, not a real namespace")
		assert.Equal(t, "stacks-42", tctx.Attributes()["namespace"])
	})

	t.Run("ns itself being 'default' or '*' is never used", func(t *testing.T) {
		for _, ns := range []string{"default", "*"} {
			ctx := WithTransactionContextFallback(context.Background(), ns)

			tctx := openfeature.TransactionContext(ctx)
			assert.Empty(t, tctx.TargetingKey(), "ns=%q", ns)
		}
	})
}
