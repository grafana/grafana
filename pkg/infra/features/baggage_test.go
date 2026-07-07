package features

import (
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

func TestInstanceContextFromBaggage(t *testing.T) {
	t.Run("empty context returns empty eval context", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		evalCtx := InstanceContextFromBaggage(req.Context())

		assert.Empty(t, evalCtx.TargetingKey())
		assert.Empty(t, evalCtx.Attributes())
	})

	t.Run("all canonical fields are extracted", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,plan=pro,channel=stable,namespace=stacks-42,grafana_version=13.0.0,stackId=42,instanceURL=https://mystack.grafana.net")
		evalCtx := InstanceContextFromBaggage(req.Context())

		attrs := evalCtx.Attributes()
		assert.Equal(t, "mystack", attrs["slug"])
		assert.Equal(t, "pro", attrs["plan"])
		assert.Equal(t, "stable", attrs["channel"])
		assert.Equal(t, "stacks-42", attrs["namespace"])
		assert.Equal(t, "13.0.0", attrs["grafana_version"])
		assert.Equal(t, "42", attrs["stackId"])
		assert.Equal(t, "https://mystack.grafana.net", attrs["instanceURL"])
	})

	t.Run("absent fields are not added to attributes", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,namespace=stacks-42")
		evalCtx := InstanceContextFromBaggage(req.Context())

		attrs := evalCtx.Attributes()
		assert.Contains(t, attrs, "slug")
		assert.Contains(t, attrs, "namespace")
		assert.NotContains(t, attrs, "plan")
		assert.NotContains(t, attrs, "channel")
		assert.NotContains(t, attrs, "stackId")
	})

	t.Run("non-canonical baggage members are not included", func(t *testing.T) {
		req := baggageCtx(t, "namespace=stacks-42,custom-key=should-be-ignored")
		evalCtx := InstanceContextFromBaggage(req.Context())

		assert.NotContains(t, evalCtx.Attributes(), "custom-key")
	})

	t.Run("missing namespace results in empty targeting key", func(t *testing.T) {
		req := baggageCtx(t, "slug=mystack,plan=pro")
		evalCtx := InstanceContextFromBaggage(req.Context())

		assert.Empty(t, evalCtx.TargetingKey())
		assert.Equal(t, "mystack", evalCtx.Attributes()["slug"])
	})
}

func TestWithTransactionContextMiddleware(t *testing.T) {
	t.Run("sets OF transaction context from baggage", func(t *testing.T) {
		var capturedReq *http.Request
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedReq = r
		})

		handler := WithTransactionContextMiddleware(next)
		req := baggageCtx(t, "slug=mystack,plan=pro,namespace=stacks-42")
		handler.ServeHTTP(httptest.NewRecorder(), req)

		require.NotNil(t, capturedReq)
		tctx := openfeature.TransactionContext(capturedReq.Context())
		assert.Equal(t, "stacks-42", tctx.TargetingKey())
		assert.Equal(t, "mystack", tctx.Attributes()["slug"])
		assert.Equal(t, "pro", tctx.Attributes()["plan"])
	})

	t.Run("empty baggage results in empty transaction context", func(t *testing.T) {
		var capturedReq *http.Request
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedReq = r
		})

		handler := WithTransactionContextMiddleware(next)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)

		require.NotNil(t, capturedReq)
		tctx := openfeature.TransactionContext(capturedReq.Context())
		assert.Empty(t, tctx.TargetingKey())
		assert.Empty(t, tctx.Attributes())
	})

	t.Run("merges with existing transaction context", func(t *testing.T) {
		var capturedReq *http.Request
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			capturedReq = r
		})

		handler := WithTransactionContextMiddleware(next)

		existing := openfeature.NewEvaluationContext("prior-key", map[string]any{
			"cluster": "prod-eu-center-1",
			"slug":    "old-slug",
		})
		req := baggageCtx(t, "namespace=stacks-42,slug=mystack")
		req = req.WithContext(openfeature.WithTransactionContext(req.Context(), existing))

		handler.ServeHTTP(httptest.NewRecorder(), req)

		require.NotNil(t, capturedReq)
		tctx := openfeature.TransactionContext(capturedReq.Context())

		// baggage wins on targeting key
		assert.Equal(t, "stacks-42", tctx.TargetingKey())
		// baggage wins on conflicting attribute
		assert.Equal(t, "mystack", tctx.Attributes()["slug"])
		// prior context values that don't conflict are preserved
		assert.Equal(t, "prod-eu-center-1", tctx.Attributes()["cluster"])
	})

	t.Run("calls next handler", func(t *testing.T) {
		called := false
		next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
			w.WriteHeader(http.StatusOK)
		})

		handler := WithTransactionContextMiddleware(next)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		assert.True(t, called)
		assert.Equal(t, http.StatusOK, rec.Code)
	})
}
