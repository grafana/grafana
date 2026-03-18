package frontend

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func newTestPreviewHandler(previewCfg PreviewAssetsConfig) *previewAssetsHandler {
	return newPreviewAssetsHandler(&setting.Cfg{}, previewCfg)
}

func TestPreviewAssetsHandler_GET(t *testing.T) {
	t.Run("should show confirmation page with CSRF token", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		req := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_42_mybranch", nil)
		rec := httptest.NewRecorder()

		handler.handleGet(rec, req)

		assert.Equal(t, 200, rec.Code)
		body := rec.Body.String()
		assert.Contains(t, body, "pr_grafana_42_mybranch")
		assert.Contains(t, body, "https://storage.example.com/bucket/pr_grafana_42_mybranch/")
		assert.Contains(t, body, "csrf_token")
		assert.Contains(t, body, "Load Preview Assets")

		// Should set a CSRF cookie
		cookies := rec.Result().Cookies()
		var csrfCookie *http.Cookie
		for _, c := range cookies {
			if c.Name == csrfCookieName {
				csrfCookie = c
			}
		}
		require.NotNil(t, csrfCookie, "CSRF cookie should be set")
		assert.True(t, csrfCookie.HttpOnly)
		assert.Equal(t, "/-/set-preview-assets", csrfCookie.Path)
	})

	t.Run("should reject when feature is disabled", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: false,
		})

		req := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_42_mybranch", nil)
		rec := httptest.NewRecorder()

		handler.handleGet(rec, req)

		assert.Equal(t, 400, rec.Code)
		assert.Contains(t, rec.Body.String(), "not enabled")
	})

	t.Run("should reject when base URL is not configured", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "",
		})

		req := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_42_mybranch", nil)
		rec := httptest.NewRecorder()

		handler.handleGet(rec, req)

		assert.Equal(t, 400, rec.Code)
		assert.Contains(t, rec.Body.String(), "not configured")
	})

	t.Run("should reject invalid asset IDs", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		for _, id := range []string{"../etc/passwd", "foo bar", "a?b=c", "<script>"} {
			req := httptest.NewRequest("GET", "/-/set-preview-assets?assets="+url.QueryEscape(id), nil)
			rec := httptest.NewRecorder()

			handler.handleGet(rec, req)

			assert.Equal(t, 400, rec.Code, "should reject ID: %s", id)
		}
	})

	t.Run("should accept valid asset IDs", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		for _, id := range []string{"pr_grafana_42_mybranch", "pr_grafana_123_feat_foo", "v10_preview1"} {
			req := httptest.NewRequest("GET", "/-/set-preview-assets?assets="+url.QueryEscape(id), nil)
			rec := httptest.NewRecorder()

			handler.handleGet(rec, req)

			assert.Equal(t, 200, rec.Code, "should accept ID: %s", id)
		}
	})

	t.Run("should reject when assets parameter is missing", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
		})

		req := httptest.NewRequest("GET", "/-/set-preview-assets", nil)
		rec := httptest.NewRecorder()

		handler.handleGet(rec, req)

		assert.Equal(t, 400, rec.Code)
	})
}

func TestPreviewAssetsHandler_POST(t *testing.T) {
	t.Run("should set cookie with valid CSRF token", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		// First, do GET to get the CSRF token
		getReq := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_42_mybranch", nil)
		getRec := httptest.NewRecorder()
		handler.handleGet(getRec, getReq)

		// Extract CSRF cookie and token from the response
		var csrfCookieValue string
		for _, c := range getRec.Result().Cookies() {
			if c.Name == csrfCookieName {
				csrfCookieValue = c.Value
			}
		}
		require.NotEmpty(t, csrfCookieValue)

		// Now POST with the CSRF token
		formData := url.Values{
			"assets":     {"pr_grafana_42_mybranch"},
			"csrf_token": {csrfCookieValue},
		}
		postReq := httptest.NewRequest("POST", "/-/set-preview-assets", strings.NewReader(formData.Encode()))
		postReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		postReq.AddCookie(&http.Cookie{
			Name:  csrfCookieName,
			Value: csrfCookieValue,
		})
		postRec := httptest.NewRecorder()

		handler.handlePost(postRec, postReq)

		assert.Equal(t, 303, postRec.Code)
		assert.Equal(t, "/", postRec.Header().Get("Location"))

		// Should set the assets override cookie with just the ID
		var overrideCookie *http.Cookie
		for _, c := range postRec.Result().Cookies() {
			if c.Name == assetsOverrideCookieName {
				overrideCookie = c
			}
		}
		require.NotNil(t, overrideCookie)
		assert.Equal(t, "pr_grafana_42_mybranch", overrideCookie.Value)
		assert.True(t, overrideCookie.HttpOnly)
		assert.Equal(t, "/", overrideCookie.Path)
		assert.Equal(t, int(cookieMaxAge.Seconds()), overrideCookie.MaxAge)
	})

	t.Run("should reject when CSRF token is missing", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		formData := url.Values{
			"assets":     {"pr_grafana_42_mybranch"},
			"csrf_token": {"some-fake-token"},
		}
		req := httptest.NewRequest("POST", "/-/set-preview-assets", strings.NewReader(formData.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		// No CSRF cookie set
		rec := httptest.NewRecorder()

		handler.handlePost(rec, req)

		assert.Equal(t, 403, rec.Code)
	})

	t.Run("should reject when CSRF token does not match", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		formData := url.Values{
			"assets":     {"pr_grafana_42_mybranch"},
			"csrf_token": {"wrong-token"},
		}
		req := httptest.NewRequest("POST", "/-/set-preview-assets", strings.NewReader(formData.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.AddCookie(&http.Cookie{
			Name:  csrfCookieName,
			Value: "correct-token",
		})
		rec := httptest.NewRecorder()

		handler.handlePost(rec, req)

		assert.Equal(t, 403, rec.Code)
		assert.Contains(t, rec.Body.String(), "CSRF token mismatch")
	})

	t.Run("should reject invalid asset ID on POST", func(t *testing.T) {
		handler := newTestPreviewHandler(PreviewAssetsConfig{
			Enabled: true,
			BaseURL: "https://storage.example.com/bucket/",
		})

		csrfToken := "matching-token"
		formData := url.Values{
			"assets":     {"../../../etc/passwd"},
			"csrf_token": {csrfToken},
		}
		req := httptest.NewRequest("POST", "/-/set-preview-assets", strings.NewReader(formData.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.AddCookie(&http.Cookie{
			Name:  csrfCookieName,
			Value: csrfToken,
		})
		rec := httptest.NewRecorder()

		handler.handlePost(rec, req)

		assert.Equal(t, 400, rec.Code)
	})
}
