package frontend

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

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
	err := os.MkdirAll(buildDir, 0o750)
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

	err = os.WriteFile(filepath.Join(buildDir, "assets-manifest.json"), []byte(manifest), 0o644)
	require.NoError(tb, err)

	return publicDir
}

func TestFrontendService_WebAssets(t *testing.T) {
	t.Run("should serve index with proper assets", func(t *testing.T) {
		publicDir := setupTestWebAssets(t)
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev, // needs to be dev to bypass the cache
		}
		service := createTestService(t, setting.ProvideService(cfg))

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		// Test index route which should load web assets
		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		assert.Contains(t, recorder.Header().Get("Content-Type"), "text/html")

		// The response should contain references to the assets
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.js\" type=\"text/javascript\"")
		assert.Contains(t, body, "src=\"public/build/app.js\" type=\"text/javascript\"")
	})

	t.Run("should handle missing assets manifest gracefully", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: "/dev/null", // No build directory or manifest
			Env:            setting.Dev, // needs to be dev to bypass the cache
		}
		service := createTestService(t, setting.ProvideService(cfg))

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		// Test index route which should fail to load web assets
		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		// Should return 500 due to missing assets manifest
		assert.Equal(t, 500, recorder.Code)
	})
}
