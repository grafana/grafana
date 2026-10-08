package frontend

import (
	"fmt"
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

	writeTestWebAssets(tb, publicDir, "build/rspack")

	return publicDir
}

// writeTestWebAssets writes a manifest and boot script under the given build directory.
// The asset URLs show which manifest was read.
func writeTestWebAssets(tb testing.TB, publicDir string, dir string) {
	tb.Helper()

	// Create build directory
	buildDir := filepath.Join(publicDir, dir)
	err := os.MkdirAll(buildDir, 0750)
	require.NoError(tb, err)

	// Create test assets manifest
	urlPrefix := "public/" + dir

	manifest := fmt.Sprintf(`{
		"entrypoints": {
			"esModule": true,
			"app": {
				"assets": {
					"js": [
						"%[1]s/runtime.js",
						"%[1]s/app.js"
					],
					"css": ["%[1]s/grafana.app.css"]
				}
			},
			"swagger": {
				"assets": {
					"js": ["%[1]s/runtime.js", "%[1]s/swagger.js"],
					"css": ["%[1]s/grafana.swagger.css"]
				}
			},
			"dark": {
				"assets": {
					"css": ["%[1]s/grafana.dark.css"]
				}
			},
			"light": {
				"assets": {
					"css": ["%[1]s/grafana.light.css"]
				}
			}
		},
		"runtime.js": {
			"src": "%[1]s/runtime.js",
			"integrity": "sha256-test123"
		},
		"app.js": {
			"src": "%[1]s/app.js",
			"integrity": "sha256-test456"
		}
	}`, urlPrefix)

	err = os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(manifest), 0644)
	require.NoError(tb, err)

	err = os.WriteFile(filepath.Join(buildDir, "boot.js"), []byte("// test boot stub for "+dir), 0644)
	require.NoError(tb, err)
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
		assert.Contains(t, body, "src=\"public/build/rspack/runtime.js\"")
		assert.Contains(t, body, "src=\"public/build/rspack/app.js\"")
		assert.Contains(t, body, "type=\"module\"")
		assert.Contains(t, body, "// test boot stub for build/rspack")
		// Static images are copied into the build directory, so they move with it.
		assert.Contains(t, body, "href=\"public/build/rspack/img/fav32.png\"")
	})

	t.Run("should serve the preview build when the preview cookie is set", func(t *testing.T) {
		const folder = "pr_grafana_123456"
		bucket := newPreviewBucketServer(t, folder)
		mux := setupPreviewTestMux(t, bucket.URL+"/")
		previewURL := bucket.URL + "/" + folder + "/"

		req := newPreviewRequest("/")
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: folder})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)
		require.Equal(t, http.StatusOK, recorder.Code)

		body := recorder.Body.String()
		assert.Contains(t, body, "window.__grafanaPreviewAssets = '"+folder+"'")
		assert.Contains(t, body, previewURL+"public/build/rspack/runtime.preview.js")
		assert.Contains(t, body, previewURL+"public/build/rspack/app.preview.js")
		assert.Contains(t, body, previewURL+"public/build/rspack/grafana.app.preview.css")
		assert.Contains(t, body, `integrity="sha256-preview-runtime"`)
		assert.Contains(t, body, `integrity="sha256-preview-app"`)
		assert.Contains(t, body, `type="module"`)
		assert.Contains(t, body, "// test boot stub for build/rspack")
	})

	t.Run("should fall back to default assets when the preview build cannot be loaded", func(t *testing.T) {
		bucket := httptest.NewServer(http.NotFoundHandler())
		t.Cleanup(bucket.Close)
		mux := setupPreviewTestMux(t, bucket.URL+"/")

		req := newPreviewRequest("/")
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: "pr_grafana_does_not_exist"})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/rspack/runtime.js\"")
		assert.Contains(t, body, "href=\"public/build/rspack/img/fav32.png\"")
		assert.NotContains(t, body, "window.__grafanaPreviewAssets")
	})

	t.Run("should ignore the preview cookie for a namespace that has not opted in", func(t *testing.T) {
		const folder = "pr_grafana_123456"
		bucket := newPreviewBucketServer(t, folder)
		mux := setupPreviewTestMux(t, bucket.URL+"/")

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("baggage", "namespace=stacks-other")
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: folder})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/rspack/runtime.js\"")
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
		assert.Contains(t, body, "src=\"public/build/rspack/runtime.js\"")
		assert.NotContains(t, body, "window.__grafanaPreviewAssets")
	})

	t.Run("should fail to start without a boot script", func(t *testing.T) {
		publicDir := t.TempDir()
		cfg := &setting.Cfg{
			Raw:            ini.Empty(),
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev,
		}

		_, err := newTestService(cfg)
		require.ErrorContains(t, err, "no boot script found")
	})
}
