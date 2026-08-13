package features

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

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
