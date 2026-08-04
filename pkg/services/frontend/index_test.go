package frontend

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// setupTestWebAssets creates a temporary directory with test assets manifest
func setupTestWebAssets(tb testing.TB) string {
	tb.Helper()

	publicDir := tb.TempDir()
	tb.Cleanup(func() { _ = os.RemoveAll(publicDir) })

	// Create build directory
	buildDir := filepath.Join(publicDir, "build")
	err := os.MkdirAll(buildDir, 0750)
	require.NoError(tb, err)

	// Create test assets manifest
	manifest := `{
		"entrypoints": {
			"app": {
				"assets": {
					"js": [
						"public/build/runtime.js",
						"public/build/app.js"
					],
					"css": ["public/build/grafana.app.css"]
				}
			},
			"swagger": {
				"assets": {
					"js": ["public/build/runtime.js", "public/build/swagger.js"],
					"css": ["public/build/grafana.swagger.css"]
				}
			},
			"dark": {
				"assets": {
					"css": ["public/build/grafana.dark.css"]
				}
			},
			"light": {
				"assets": {
					"css": ["public/build/grafana.light.css"]
				}
			}
		},
		"runtime.js": {
			"src": "public/build/runtime.js",
			"integrity": "sha256-test123"
		},
		"app.js": {
			"src": "public/build/app.js",
			"integrity": "sha256-test456"
		}
	}`

	err = os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(manifest), 0644)
	require.NoError(tb, err)

	err = os.WriteFile(filepath.Join(buildDir, "boot.js"), []byte("// test boot stub"), 0644)
	require.NoError(tb, err)

	return publicDir
}

func TestFrontendService_WebAssets(t *testing.T) {
	t.Run("should serve index with proper assets", func(t *testing.T) {
		publicDir := setupTestWebAssets(t)
		cfg := &setting.Cfg{
			Raw:            ini.Empty(),
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev, // needs to be dev to bypass the cache
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		// Test index route which should load web assets
		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		assert.Contains(t, recorder.Header().Get("Content-Type"), "text/html")
		assert.Contains(t, recorder.Header().Get("Cache-Control"), "no-store")

		// The response should contain references to the assets
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.js\" type=\"text/javascript\"")
		assert.Contains(t, body, "src=\"public/build/app.js\" type=\"text/javascript\"")
	})

	t.Run("should serve preview assets when the preview cookie is set", func(t *testing.T) {
		const folder = "pr_grafana_123456"
		bucket := newPreviewBucketServer(t, folder)
		mux := setupPreviewTestMux(t, bucket.URL+"/")
		previewURL := bucket.URL + "/" + folder + "/"

		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: folder})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()

		// Asset URLs should point at the preview build
		assert.Contains(t, body, previewURL+"public/build/runtime.preview.js")
		assert.Contains(t, body, previewURL+"public/build/app.preview.js")
		assert.NotContains(t, body, "src=\"public/build/runtime.js\"")
		assert.NotContains(t, body, "src=\"public/build/app.js\"")

		// The page should flag that preview assets are active
		assert.Contains(t, body, "window.__grafanaPreviewAssets = '"+folder+"'")
	})

	t.Run("should fall back to default assets when the preview build cannot be loaded", func(t *testing.T) {
		bucket := httptest.NewServer(http.NotFoundHandler())
		t.Cleanup(bucket.Close)
		mux := setupPreviewTestMux(t, bucket.URL+"/")

		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: "pr_grafana_does_not_exist"})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.js\"")
		assert.NotContains(t, body, "window.__grafanaPreviewAssets")
	})

	t.Run("should ignore the preview cookie when the feature is disabled", func(t *testing.T) {
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

		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: "pr_grafana_123456"})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.js\"")
		assert.NotContains(t, body, "window.__grafanaPreviewAssets")
	})
}
