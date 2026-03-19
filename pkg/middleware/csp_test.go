package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestReplacePolicyVariables(t *testing.T) {
	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with single host", func(t *testing.T) {
		result := ReplacePolicyVariables("default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS", "", []string{"wiki.example.com"}, "")
		assert.Equal(t, "default-src 'self'; frame-ancestors wiki.example.com", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with multiple hosts", func(t *testing.T) {
		result := ReplacePolicyVariables("default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS", "", []string{"wiki.example.com", "foo.example.com"}, "")
		assert.Equal(t, "default-src 'self'; frame-ancestors wiki.example.com foo.example.com", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with wildcard", func(t *testing.T) {
		result := ReplacePolicyVariables("default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS", "", []string{"*"}, "")
		assert.Equal(t, "default-src 'self'; frame-ancestors *", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with empty string when hosts is nil", func(t *testing.T) {
		result := ReplacePolicyVariables("default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS", "", nil, "")
		assert.Equal(t, "default-src 'self'; frame-ancestors ", result)
	})

	t.Run("leaves policy unchanged when $ALLOW_EMBEDDING_HOSTS not present", func(t *testing.T) {
		result := ReplacePolicyVariables("default-src 'self'", "", []string{"wiki.example.com"}, "")
		assert.Equal(t, "default-src 'self'", result)
	})
}

// newRequestWithContext builds a minimal HTTP request with a ReqContext injected, as required by cspMiddleware.
func newRequestWithContext() *http.Request {
	req := httptest.NewRequest("GET", "/", nil)
	reqCtx := &contextmodel.ReqContext{
		Context: web.FromContext(req.Context()),
	}
	return req.WithContext(ctxkey.Set(req.Context(), reqCtx))
}

func TestCspMiddlewareXFrameOptions(t *testing.T) {
	logger := log.New("test")

	newHandler := func(cfg *setting.Cfg) http.Handler {
		return ContentSecurityPolicy(cfg, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	}

	t.Run("sets X-Frame-Options deny when AllowEmbeddingHosts is empty", func(t *testing.T) {
		cfg := setting.NewCfg()
		// CSP deliberately disabled to match the common production default

		rec := httptest.NewRecorder()
		newHandler(cfg).ServeHTTP(rec, newRequestWithContext())

		assert.Equal(t, "deny", rec.Header().Get("X-Frame-Options"))
	})

	t.Run("does not set X-Frame-Options when AllowEmbeddingHosts is wildcard", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AllowEmbeddingHosts = []string{"*"}

		rec := httptest.NewRecorder()
		newHandler(cfg).ServeHTTP(rec, newRequestWithContext())

		assert.Empty(t, rec.Header().Get("X-Frame-Options"))
	})

	t.Run("does not set X-Frame-Options when specific hosts configured and CSP enabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AllowEmbeddingHosts = []string{"wiki.example.com"}
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS"

		rec := httptest.NewRecorder()
		newHandler(cfg).ServeHTTP(rec, newRequestWithContext())

		assert.Empty(t, rec.Header().Get("X-Frame-Options"))
	})

	t.Run("sets X-Frame-Options deny when specific hosts configured but CSP not enabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.AllowEmbeddingHosts = []string{"wiki.example.com"}
		// CSP deliberately not enabled

		rec := httptest.NewRecorder()
		newHandler(cfg).ServeHTTP(rec, newRequestWithContext())

		assert.Equal(t, "deny", rec.Header().Get("X-Frame-Options"))
	})
}
