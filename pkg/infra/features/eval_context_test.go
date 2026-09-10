package features

import (
	"net/http"
	"net/http/httptest"
	"testing"

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
