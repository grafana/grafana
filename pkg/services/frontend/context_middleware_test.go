package frontend

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	gokitlog "github.com/go-kit/log"
	"github.com/stretchr/testify/assert"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/middleware/loggermw"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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

func TestRequestLogIncludesUserAgent(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.RouterLogging = true
	features := featuremgmt.WithFeatures()

	service := &frontendService{cfg: cfg, features: features}

	// setRequestContext builds reqContext.Logger from log.New("context"). Swap the
	// cached instance's inner logger to capture the access log line emitted by
	// loggermw, while preserving the contextual fields added via .New(...).
	var buf bytes.Buffer
	contextLogger := log.New("context")
	contextLogger.Swap(gokitlog.NewLogfmtLogger(gokitlog.NewSyncWriter(&buf)))
	t.Cleanup(func() {
		contextLogger.Swap(gokitlog.NewLogfmtLogger(gokitlog.NewSyncWriter(io.Discard)))
	})

	loggerMW := loggermw.Provide(cfg, features)

	m := web.New()
	m.UseMiddleware(service.contextMiddleware())
	m.UseMiddleware(loggerMW.Middleware())
	m.Get("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("includes user_agent field when User-Agent header is set", func(t *testing.T) {
		buf.Reset()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("User-Agent", "TestAgent/1.0")
		rec := httptest.NewRecorder()

		m.ServeHTTP(rec, req)

		assert.Contains(t, buf.String(), "Request Completed")
		assert.Contains(t, buf.String(), "user_agent=TestAgent/1.0")
	})

	t.Run("omits user_agent field when User-Agent header is not set", func(t *testing.T) {
		buf.Reset()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Del("User-Agent")
		rec := httptest.NewRecorder()

		m.ServeHTTP(rec, req)

		assert.Contains(t, buf.String(), "Request Completed")
		assert.NotContains(t, buf.String(), "user_agent")
	})
}
