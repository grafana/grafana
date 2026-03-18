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

	return publicDir
}

// previewAssetsManifest is a test manifest served by the mock CDN server for preview assets tests
const previewAssetsManifest = `{
	"entrypoints": {
		"app": {
			"assets": {
				"js": [
					"public/build/runtime.preview123.js",
					"public/build/app.preview456.js"
				],
				"css": ["public/build/grafana.app.preview.css"]
			}
		},
		"swagger": {
			"assets": {
				"js": ["public/build/runtime.preview123.js", "public/build/swagger.preview.js"],
				"css": ["public/build/grafana.swagger.preview.css"]
			}
		},
		"dark": {
			"assets": {
				"css": ["public/build/grafana.dark.preview.css"]
			}
		},
		"light": {
			"assets": {
				"css": ["public/build/grafana.light.preview.css"]
			}
		}
	},
	"runtime.preview123.js": {
		"src": "public/build/runtime.preview123.js",
		"integrity": "sha256-preview-runtime"
	},
	"app.preview456.js": {
		"src": "public/build/app.preview456.js",
		"integrity": "sha256-preview-app"
	}
}`

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

	t.Run("should serve index with override assets when cookie is set", func(t *testing.T) {
		// Start a mock CDN server that serves the override manifest
		cdnServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/pr_grafana_123_mybranch/public/build/assets-manifest.json" {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(previewAssetsManifest))
				return
			}
			http.NotFound(w, r)
		}))
		defer cdnServer.Close()

		publicDir := setupTestWebAssets(t)
		raw := ini.Empty()
		raw.Section("server").Key("assets_base_override_enabled").SetValue("true")
		raw.Section("server").Key("assets_base_override_base_url").SetValue(cdnServer.URL + "/")
		cfg := &setting.Cfg{
			Raw:            raw,
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev,
		}
		service := createTestService(t, cfg)

		overrideURL := cdnServer.URL + "/pr_grafana_123_mybranch/"

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		// Cookie stores just the asset ID, not the full URL
		req.AddCookie(&http.Cookie{
			Name:  assetsOverrideCookieName,
			Value: "pr_grafana_123_mybranch",
		})
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		body := recorder.Body.String()
		// Should contain the override asset URLs prefixed with the CDN URL
		assert.Contains(t, body, overrideURL+"public/build/runtime.preview123.js")
		assert.Contains(t, body, overrideURL+"public/build/app.preview456.js")
		// Should NOT contain the default assets
		assert.NotContains(t, body, "src=\"public/build/runtime.js\"")
		assert.NotContains(t, body, "src=\"public/build/app.js\"")
	})
}
