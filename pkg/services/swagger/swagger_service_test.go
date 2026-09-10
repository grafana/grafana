package swagger

import (
	"fmt"
	"html"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// newTestCfg returns a config pointing at a static root holding a swagger assets
// manifest. Env is Dev because webassets.GetWebAssets caches manifests globally
// for every other environment, which would leak between tests.
func newTestCfg(tb testing.TB) *setting.Cfg {
	tb.Helper()

	publicDir := tb.TempDir()
	assetsDir := filepath.Join(publicDir, buildDir)
	require.NoError(tb, os.MkdirAll(assetsDir, 0750))

	manifest := fmt.Sprintf(`{
		"entrypoints": {
			"app": {
				"assets": {
					"js": ["%[1]s/runtime.js", "%[1]s/swagger.js"],
					"css": ["%[1]s/grafana.swagger.css"]
				}
			}
		}
	}`, "public/"+buildDir)
	require.NoError(tb, os.WriteFile(filepath.Join(assetsDir, "assets-manifest.json"), []byte(manifest), 0600))

	return &setting.Cfg{
		Raw:            ini.Empty(),
		Env:            setting.Dev,
		HTTPPort:       "3000",
		StaticRootPath: publicDir,
	}
}

func createTestService(tb testing.TB, cfg *setting.Cfg) *swaggerService {
	tb.Helper()

	var promRegister prometheus.Registerer = prometheus.NewRegistry()
	promGatherer := promRegister.(*prometheus.Registry)

	service, err := ProvideSwaggerService(cfg, featuremgmt.WithFeatures(), promGatherer, promRegister, &licensing.OSSLicensingService{})
	require.NoError(tb, err)

	return service
}

func newTestMux(tb testing.TB, service *swaggerService) *web.Mux {
	tb.Helper()

	mux := web.New()
	service.addMiddlewares(mux)
	service.registerRoutes(mux)

	return mux
}

func TestSwaggerService_ServerCreation(t *testing.T) {
	cfg := newTestCfg(t)
	cfg.HTTPPort = "1234"
	cfg.HTTPAddr = "127.0.0.1"

	service := createTestService(t, cfg)
	server := service.newSwaggerServer(t.Context())

	assert.Equal(t, "127.0.0.1:1234", server.Addr)
	assert.NotNil(t, server.Handler)
}

func TestSwaggerService_Routes(t *testing.T) {
	service := createTestService(t, newTestCfg(t))
	mux := newTestMux(t, service)

	t.Run("should render the swagger page", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, "text/html; charset=UTF-8", recorder.Header().Get("Content-Type"))

		body := recorder.Body.String()
		assert.Contains(t, body, "<title>Grafana API Reference</title>")
		assert.Contains(t, body, `src="public/build-swagger/swagger.js"`)
		assert.Contains(t, body, `href="public/build-swagger/grafana.swagger.css"`)
	})

	t.Run("should redirect the deprecated routes to /swagger", func(t *testing.T) {
		for _, path := range []string{"/swagger-ui", "/openapi3"} {
			t.Run(path, func(t *testing.T) {
				req := httptest.NewRequest(http.MethodGet, path, nil)
				recorder := httptest.NewRecorder()

				mux.ServeHTTP(recorder, req)

				assert.Equal(t, http.StatusMovedPermanently, recorder.Code)
				assert.Equal(t, "/swagger", recorder.Header().Get("Location"))
			})
		}
	})

	t.Run("should serve the swagger bundle from the static root", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/public/build-swagger/assets-manifest.json", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Contains(t, recorder.Body.String(), "public/build-swagger/swagger.js")
	})

	t.Run("should return health status correctly", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/-/health", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, "OK", strings.TrimSpace(recorder.Body.String()))
	})

	t.Run("should return prometheus metrics", func(t *testing.T) {
		testCounter := prometheus.NewCounter(prometheus.CounterOpts{Name: "shrimp_count"})
		require.NoError(t, service.promRegister.Register(testCounter))
		testCounter.Inc()

		req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Contains(t, recorder.Body.String(), "\nshrimp_count 1\n")
	})
}

func TestSwaggerService_CSP(t *testing.T) {
	t.Run("should set the header and reuse its nonce in the page", func(t *testing.T) {
		cfg := newTestCfg(t)
		cfg.CSPEnabled = true
		cfg.CSPTemplate = "script-src $NONCE;"
		mux := newTestMux(t, createTestService(t, cfg))

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)

		header := recorder.Header().Get("Content-Security-Policy")
		require.Regexp(t, `^script-src 'nonce-[^']+';$`, header)

		nonce := strings.TrimSuffix(strings.TrimPrefix(header, "script-src 'nonce-"), "';")

		// Nonces are base64, so the rendered attributes may contain character
		// references (html/template escapes "+" and "'"). Compare decoded text.
		body := html.UnescapeString(recorder.Body.String())
		assert.Contains(t, body, fmt.Sprintf(`nonce="%s"`, nonce))
		// Dev builds also inline the policy so it survives proxies that strip the header.
		assert.Contains(t, body, fmt.Sprintf(`content="script-src 'nonce-%s';"`, nonce))
	})

	t.Run("should not emit a policy when CSP is disabled", func(t *testing.T) {
		mux := newTestMux(t, createTestService(t, newTestCfg(t)))

		req := httptest.NewRequest(http.MethodGet, "/swagger", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.Empty(t, recorder.Header().Get("Content-Security-Policy"))

		body := recorder.Body.String()
		assert.NotContains(t, body, "Content-Security-Policy")
		// The core HTTPServer only generates a nonce when CSP is on, so the page
		// this service renders must match it rather than inventing one.
		assert.Contains(t, body, `nonce=""`)
	})
}

func TestSwaggerService_Recovery(t *testing.T) {
	service := createTestService(t, newTestCfg(t))

	mux := web.New()
	service.addMiddlewares(mux)
	mux.Get("/boom", func(http.ResponseWriter, *http.Request) { panic("boom") })

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	recorder := httptest.NewRecorder()

	// middleware.Recovery renders through the template set web.Renderer installs,
	// which this service has none of, so a panic must be handled locally instead.
	assert.NotPanics(t, func() { mux.ServeHTTP(recorder, req) })
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)
}
