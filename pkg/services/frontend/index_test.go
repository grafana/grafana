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

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// setupTestWebAssets creates a temporary directory with test assets manifest
func setupTestWebAssets(tb testing.TB) string {
	tb.Helper()

	publicDir := tb.TempDir()
	tb.Cleanup(func() { _ = os.RemoveAll(publicDir) })

	writeTestWebAssets(tb, publicDir, "build", "")

	return publicDir
}

// setupTestWebAssetsWithRspack adds an rspack build next to the webpack one, as a server
// has once the frontend is built with both bundlers.
func setupTestWebAssetsWithRspack(tb testing.TB) string {
	tb.Helper()

	publicDir := setupTestWebAssets(tb)
	writeTestWebAssets(tb, publicDir, "build-rspack", ".rspack")

	return publicDir
}

// writeTestWebAssets writes a test assets manifest and boot script under the given build
// directory. Every build publishes its assets under the public/build URL prefix, so
// assetSuffix marks the file names instead, making the directory a manifest was read
// from visible in the rendered page.
func writeTestWebAssets(tb testing.TB, publicDir string, dir string, assetSuffix string) {
	tb.Helper()

	// Create build directory
	buildDir := filepath.Join(publicDir, dir)
	err := os.MkdirAll(buildDir, 0750)
	require.NoError(tb, err)

	// Create test assets manifest
	manifest := fmt.Sprintf(`{
		"entrypoints": {
			"app": {
				"assets": {
					"js": [
						"public/build/runtime%[1]s.js",
						"public/build/app%[1]s.js"
					],
					"css": ["public/build/grafana.app%[1]s.css"]
				}
			},
			"swagger": {
				"assets": {
					"js": ["public/build/runtime%[1]s.js", "public/build/swagger%[1]s.js"],
					"css": ["public/build/grafana.swagger%[1]s.css"]
				}
			},
			"dark": {
				"assets": {
					"css": ["public/build/grafana.dark%[1]s.css"]
				}
			},
			"light": {
				"assets": {
					"css": ["public/build/grafana.light%[1]s.css"]
				}
			}
		},
		"runtime.js": {
			"src": "public/build/runtime%[1]s.js",
			"integrity": "sha256-test123"
		},
		"app.js": {
			"src": "public/build/app%[1]s.js",
			"integrity": "sha256-test456"
		}
	}`, assetSuffix)

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
		assert.Contains(t, body, "src=\"public/build/runtime.js\" type=\"text/javascript\"")
		assert.Contains(t, body, "src=\"public/build/app.js\" type=\"text/javascript\"")
	})

	t.Run("should serve preview assets when the preview cookie is set", func(t *testing.T) {
		const folder = "pr_grafana_123456"
		bucket := newPreviewBucketServer(t, folder)
		mux := setupPreviewTestMux(t, bucket.URL+"/")
		previewURL := bucket.URL + "/" + folder + "/"

		req := newPreviewRequest("/")
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

		req := newPreviewRequest("/")
		req.AddCookie(&http.Cookie{Name: previewAssetsCookieName, Value: "pr_grafana_does_not_exist"})
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.js\"")
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

	t.Run("should read the rspack build when the rspack flag is enabled", func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRspackBuild)

		publicDir := setupTestWebAssetsWithRspack(t)
		cfg := &setting.Cfg{
			Raw:            ini.Empty(),
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev, // needs to be dev to bypass the cache
		}
		service := createTestService(t, cfg)
		assert.Equal(t, "build-rspack", service.buildDir)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// The assets come from the rspack manifest, still under the public/build prefix
		body := recorder.Body.String()
		assert.Contains(t, body, "src=\"public/build/runtime.rspack.js\" type=\"text/javascript\"")
		assert.Contains(t, body, "src=\"public/build/app.rspack.js\" type=\"text/javascript\"")
		assert.NotContains(t, body, "src=\"public/build/runtime.js\"")
		assert.Contains(t, body, "// test boot stub for build-rspack")
	})

	t.Run("should refuse to start when the rspack flag is on but the build is missing", func(t *testing.T) {
		featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRspackBuild)

		publicDir := setupTestWebAssets(t) // webpack assets only
		cfg := &setting.Cfg{
			Raw:            ini.Empty(),
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			Env:            setting.Dev,
		}

		_, err := newTestService(cfg)
		require.ErrorContains(t, err, "read boot.js")
		require.ErrorContains(t, err, "build-rspack")
		require.ErrorIs(t, err, os.ErrNotExist)
	})
}
