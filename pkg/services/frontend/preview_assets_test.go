package frontend

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	fswebassets "github.com/grafana/grafana/pkg/services/frontend/webassets"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// previewTestNamespace is allowlisted in setupPreviewTestMux.
const previewTestNamespace = "stacks-123456"

// previewTestManifest is served by the mock bucket server in preview assets tests.
const previewTestManifest = `{
	"entrypoints": {
		"app": {
			"assets": {
				"js": ["public/build/runtime.preview.js", "public/build/app.preview.js"],
				"css": ["public/build/grafana.app.preview.css"]
			}
		},
		"dark": { "assets": { "css": ["public/build/grafana.dark.preview.css"] } },
		"light": { "assets": { "css": ["public/build/grafana.light.preview.css"] } }
	}
}`

// newPreviewBucketServer returns a server that serves previewTestManifest for
// the given folder, mimicking the GCS bucket layout the CI workflow uploads.
func newPreviewBucketServer(t *testing.T, folder string) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/"+folder+"/public/build/assets-manifest.json" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(previewTestManifest))
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(server.Close)
	return server
}

func setupPreviewTestMux(t *testing.T, previewBaseURL string) *web.Mux {
	t.Helper()
	fswebassets.ResetPreviewAssetsCache()

	raw := ini.Empty()
	raw.Section("frontend_service").Key("preview_assets_enabled").SetValue("true")
	raw.Section("frontend_service").Key("preview_assets_base_url").SetValue(previewBaseURL)
	raw.Section("frontend_service").Key("preview_assets_allowed_namespaces").SetValue(previewTestNamespace)

	cfg := &setting.Cfg{
		Raw:            raw,
		HTTPPort:       "3000",
		StaticRootPath: setupTestWebAssets(t),
		Env:            setting.Dev,
	}
	service := createTestService(t, cfg)

	mux := web.New()
	service.addMiddlewares(mux)
	service.registerRoutes(mux)
	return mux
}

// newPreviewRequest makes a request from a namespace that has opted in to
// preview assets.
func newPreviewRequest(target string) *http.Request {
	req := httptest.NewRequest("GET", target, nil)
	req.Header.Set("baggage", "namespace="+previewTestNamespace)
	return req
}

func getCookie(t *testing.T, resp *http.Response, name string) *http.Cookie {
	t.Helper()
	for _, c := range resp.Cookies() {
		if c.Name == name {
			return c
		}
	}
	return nil
}

func TestPreviewAssets_RouteNotRegisteredWhenDisabled(t *testing.T) {
	publicDir := setupTestWebAssets(t)
	cfg := &setting.Cfg{
		Raw:            ini.Empty(),
		HTTPPort:       "3000",
		StaticRootPath: publicDir,
		Env:            setting.Dev,
	}
	service := createTestService(t, cfg)

	mux := web.New()
	service.addMiddlewares(mux)
	service.registerRoutes(mux)

	req := newPreviewRequest("/-/set-preview-assets?assets=pr_grafana_123")
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, req)

	// The route should not exist, so the request falls through to the index
	// wildcard and renders the app.
	assert.Equal(t, 200, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "<div id=\"reactRoot\"></div>")
	assert.NotContains(t, recorder.Body.String(), "Load preview assets")
}

func TestPreviewAssets_ConfirmationPage(t *testing.T) {
	mux := setupPreviewTestMux(t, "https://storage.example.com/bucket/")

	t.Run("should render confirmation page with resolved URL and CSRF cookie", func(t *testing.T) {
		req := newPreviewRequest("/-/set-preview-assets?assets=pr_grafana_123456")
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "pr_grafana_123456")
		assert.Contains(t, body, "https://storage.example.com/bucket/pr_grafana_123456/")
		assert.Contains(t, body, `name="confirm"`)
		assert.Equal(t, "no-referrer", recorder.Header().Get("Referrer-Policy"))
		assert.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")

		csrfCookie := getCookie(t, recorder.Result(), previewCSRFCookieName)
		require.NotNil(t, csrfCookie, "CSRF cookie should be set")
		assert.True(t, csrfCookie.HttpOnly)
		assert.Equal(t, previewAssetsPath, csrfCookie.Path)
		assert.Contains(t, body, csrfCookie.Value, "page should embed the CSRF token")
	})

	t.Run("should reject missing assets parameter", func(t *testing.T) {
		req := newPreviewRequest("/-/set-preview-assets")
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 400, recorder.Code)
	})

	t.Run("should reject invalid folder names", func(t *testing.T) {
		for _, folder := range []string{"../etc/passwd", "foo bar", "a?b=c", "<script>", "foo/bar", "foo.bar"} {
			req := newPreviewRequest("/-/set-preview-assets?assets=" + url.QueryEscape(folder))
			recorder := httptest.NewRecorder()
			mux.ServeHTTP(recorder, req)

			assert.Equal(t, 400, recorder.Code, "should reject folder: %s", folder)
			// Error responses must never echo the input back
			assert.NotContains(t, recorder.Body.String(), folder)
		}
	})
}

func TestPreviewAssets_Confirm(t *testing.T) {
	const folder = "pr_grafana_123456"

	confirmURL := func(token string) string {
		return "/-/set-preview-assets?assets=" + folder + "&confirm=" + url.QueryEscape(token)
	}

	setup := func(t *testing.T) (*web.Mux, string) {
		bucket := newPreviewBucketServer(t, folder)
		mux := setupPreviewTestMux(t, bucket.URL+"/")

		// Fetch the confirmation page to obtain a CSRF token
		req := newPreviewRequest("/-/set-preview-assets?assets=" + folder)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)
		require.Equal(t, 200, recorder.Code)

		csrfCookie := getCookie(t, recorder.Result(), previewCSRFCookieName)
		require.NotNil(t, csrfCookie)
		return mux, csrfCookie.Value
	}

	t.Run("should set the preview cookie for a valid confirmation", func(t *testing.T) {
		mux, token := setup(t)

		req := newPreviewRequest(confirmURL(token))
		req.AddCookie(&http.Cookie{Name: previewCSRFCookieName, Value: token})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 303, recorder.Code)
		assert.Equal(t, "/", recorder.Header().Get("Location"))

		previewCookie := getCookie(t, recorder.Result(), previewAssetsCookieName)
		require.NotNil(t, previewCookie, "preview cookie should be set")
		assert.Equal(t, folder, previewCookie.Value, "cookie should store only the folder name")
		assert.True(t, previewCookie.HttpOnly)
		assert.Equal(t, "/", previewCookie.Path)
		assert.Equal(t, int(previewCookieMaxAge.Seconds()), previewCookie.MaxAge, "cookie should expire after 24 hours")

		csrfCookie := getCookie(t, recorder.Result(), previewCSRFCookieName)
		require.NotNil(t, csrfCookie)
		assert.Equal(t, -1, csrfCookie.MaxAge, "CSRF cookie should be cleared")
	})

	t.Run("should reject a confirmation without the CSRF cookie", func(t *testing.T) {
		mux, token := setup(t)

		req := newPreviewRequest(confirmURL(token))
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 403, recorder.Code)
		assert.Nil(t, getCookie(t, recorder.Result(), previewAssetsCookieName))
	})

	t.Run("should reject a mismatched confirmation token", func(t *testing.T) {
		mux, token := setup(t)

		req := newPreviewRequest(confirmURL("not-the-right-token"))
		req.AddCookie(&http.Cookie{Name: previewCSRFCookieName, Value: token})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 403, recorder.Code)
		assert.Nil(t, getCookie(t, recorder.Result(), previewAssetsCookieName))
	})

	t.Run("should not set the cookie when the preview build does not exist", func(t *testing.T) {
		// Bucket server that 404s everything
		bucket := httptest.NewServer(http.NotFoundHandler())
		t.Cleanup(bucket.Close)
		mux := setupPreviewTestMux(t, bucket.URL+"/")

		req := newPreviewRequest("/-/set-preview-assets?assets=" + folder)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)
		require.Equal(t, 200, recorder.Code)
		token := getCookie(t, recorder.Result(), previewCSRFCookieName).Value

		req = newPreviewRequest(confirmURL(token))
		req.AddCookie(&http.Cookie{Name: previewCSRFCookieName, Value: token})
		recorder = httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 502, recorder.Code)
		assert.Nil(t, getCookie(t, recorder.Result(), previewAssetsCookieName))
	})
}

func TestPreviewAssets_Clear(t *testing.T) {
	mux := setupPreviewTestMux(t, "https://storage.example.com/bucket/")

	req := newPreviewRequest("/-/set-preview-assets?clear=1")
	req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: "pr_grafana_123456"})
	recorder := httptest.NewRecorder()
	mux.ServeHTTP(recorder, req)

	assert.Equal(t, 303, recorder.Code)
	assert.Equal(t, "/", recorder.Header().Get("Location"))

	previewCookie := getCookie(t, recorder.Result(), previewAssetsCookieName)
	require.NotNil(t, previewCookie)
	assert.Equal(t, "", previewCookie.Value)
	assert.Equal(t, -1, previewCookie.MaxAge)
}

func TestPreviewAssets_NamespaceLock(t *testing.T) {
	mux := setupPreviewTestMux(t, "https://storage.example.com/bucket/")

	t.Run("should 404 for a namespace that has not opted in", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_123456", nil)
		req.Header.Set("baggage", "namespace=stacks-other")
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 404, recorder.Code)
		assert.Nil(t, getCookie(t, recorder.Result(), previewCSRFCookieName))
	})

	t.Run("should 404 for a request without a namespace", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/-/set-preview-assets?assets=pr_grafana_123456", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 404, recorder.Code)
		assert.Nil(t, getCookie(t, recorder.Result(), previewCSRFCookieName))
	})
}
