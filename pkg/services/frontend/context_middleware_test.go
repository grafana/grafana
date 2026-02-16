package frontend

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"
)

func TestContextMiddleware(t *testing.T) {
	t.Run("calls next handler with context", func(t *testing.T) {
		service := &frontendService{}
		nextCalled := false
		var capturedRequest *http.Request

		nextHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			capturedRequest = r
		})

		middleware := service.contextMiddleware()
		handler := middleware(nextHandler)

		req := httptest.NewRequest(http.MethodGet, "/", nil)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.True(t, nextCalled, "next handler should be called")
		assert.NotNil(t, capturedRequest, "request should be passed to next handler")
		assert.NotNil(t, capturedRequest.Context(), "request context should be set")
	})
}

func TestSetRequestContext(t *testing.T) {
	t.Run("parses namespace from baggage header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("baggage", "namespace=stacks-123")
		rec := httptest.NewRecorder()

		ctx := setRequestContext(req.Context(), rec, req)

		namespace, ok := request.NamespaceFrom(ctx)
		assert.True(t, ok, "Namespace should be present in context")
		assert.Equal(t, "stacks-123", namespace, "Namespace should match baggage value")
	})

	t.Run("handles baggage header with multiple members", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("baggage", "trace-id=abc123,namespace=tenant-456,user-id=xyz")
		rec := httptest.NewRecorder()

		ctx := setRequestContext(req.Context(), rec, req)

		namespace, ok := request.NamespaceFrom(ctx)
		assert.True(t, ok, "Namespace should be present in context")
		assert.Equal(t, "tenant-456", namespace, "Namespace should match baggage value")
	})

	t.Run("does not set a namespace when baggage header is missing", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()

		ctx := setRequestContext(req.Context(), rec, req)

		namespace, ok := request.NamespaceFrom(ctx)
		assert.False(t, ok, "Namespace should not be present in context")
		assert.Empty(t, namespace, "Namespace should be empty when not provided")
	})

	t.Run("handles invalid baggage header gracefully", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("baggage", "invalid-baggage-format;;;")
		rec := httptest.NewRecorder()

		ctx := setRequestContext(req.Context(), rec, req)

		namespace, ok := request.NamespaceFrom(ctx)
		assert.False(t, ok, "Namespace should not be present in context")
		assert.Empty(t, namespace, "Namespace should be empty when baggage is invalid")
	})

	t.Run("handles baggage header without namespace member", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("baggage", "other-key=other-value")
		rec := httptest.NewRecorder()

		ctx := setRequestContext(req.Context(), rec, req)

		namespace, ok := request.NamespaceFrom(ctx)
		assert.False(t, ok, "Namespace should not be present in context")
		assert.Empty(t, namespace, "Namespace should be empty when namespace member not in baggage")
	})
}
