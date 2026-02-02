package frontend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/hooks"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Helper function to create a test service with minimal configuration
func createTestService(t *testing.T, cfg *setting.Cfg) *frontendService {
	t.Helper()

	features := featuremgmt.WithFeatures()
	license := &licensing.OSSLicensingService{}
	hooksService := hooks.ProvideService()

	var promRegister prometheus.Registerer = prometheus.NewRegistry()
	promGatherer := promRegister.(*prometheus.Registry)

	if cfg.BuildVersion == "" {
		cfg.BuildVersion = "10.3.0"
	}

	service, err := ProvideFrontendService(cfg, features, promGatherer, promRegister, license, hooksService)
	require.NoError(t, err)

	return service
}

func TestFrontendService_ServerCreation(t *testing.T) {
	t.Run("should create HTTP server with correct configuration", func(t *testing.T) {
		publicDir := setupTestWebAssets(t)
		cfg := &setting.Cfg{
			HTTPPort:       "1234",
			StaticRootPath: publicDir,
		}
		service := createTestService(t, cfg)

		ctx := context.Background()
		server := service.newFrontendServer(ctx)

		assert.NotNil(t, server)
		assert.Equal(t, ":1234", server.Addr)
		assert.NotNil(t, server.Handler)
		assert.NotNil(t, server.BaseContext)
	})
}

func TestFrontendService_Routes(t *testing.T) {
	publicDir := setupTestWebAssets(t)
	cfg := &setting.Cfg{
		HTTPPort:       "3000",
		StaticRootPath: publicDir,
	}
	service := createTestService(t, cfg)

	// Create a test mux to verify route registration
	mux := web.New()
	service.addMiddlewares(mux)
	service.registerRoutes(mux)

	t.Run("should handle frontend wildcard routes", func(t *testing.T) {
		// Test that routes are registered by making requests
		testCases := []struct {
			path        string
			description string
		}{
			// Metrics isn't registered in the test service?
			{"/", "index route should return HTML"},
			{"/dashboards", "browse dashboards route should return HTML"},
			{"/d/de773f33s8qgwf/fep-homepage", "dashboard route should return HTML"},
		}

		for _, tc := range testCases {
			t.Run(tc.description, func(t *testing.T) {
				req := httptest.NewRequest("GET", tc.path, nil)
				recorder := httptest.NewRecorder()

				mux.ServeHTTP(recorder, req)

				assert.Equal(t, 200, recorder.Code)
				assert.Contains(t, recorder.Body.String(), "<div id=\"reactRoot\"></div>")
			})
		}
	})

	t.Run("should handle assets 404 correctly", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/public/build/app.js", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 404, recorder.Code)
		assert.Equal(t, "404 page not found", strings.TrimSpace(recorder.Body.String()))
	})

	t.Run("should return prometheus metrics", func(t *testing.T) {
		testCounter := prometheus.NewCounter(prometheus.CounterOpts{
			Name: "shrimp_count",
		})
		err := service.promRegister.Register(testCounter)
		require.NoError(t, err)
		testCounter.Inc()

		req := httptest.NewRequest("GET", "/metrics", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Contains(t, recorder.Body.String(), "\nshrimp_count 1\n")
	})

	t.Run("should return health status correctly", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/-/health", nil)
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		assert.Equal(t, "OK", strings.TrimSpace(recorder.Body.String()))
	})
}

func TestFrontendService_Middleware(t *testing.T) {
	publicDir := setupTestWebAssets(t)
	cfg := &setting.Cfg{
		HTTPPort:       "3000",
		StaticRootPath: publicDir,
	}

	t.Run("should register route prom metrics", func(t *testing.T) {
		service := createTestService(t, cfg)
		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/dashboards", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		req = httptest.NewRequest("GET", "/public/build/app.js", nil)
		mux.ServeHTTP(recorder, req)

		req = httptest.NewRequest("GET", "/metrics", nil)
		mux.ServeHTTP(recorder, req)

		metricsBody := recorder.Body.String()
		assert.Contains(t, metricsBody, "# TYPE grafana_http_request_duration_seconds histogram")
		assert.Contains(t, metricsBody, "grafana_http_request_duration_seconds_bucket{handler=\"public-build-assets\"") // assets 404
		assert.Contains(t, metricsBody, "grafana_http_request_duration_seconds_bucket{handler=\"/*\"")                  // index route
	})

	t.Run("should add context middleware", func(t *testing.T) {
		service := createTestService(t, cfg)
		mux := web.New()
		service.addMiddlewares(mux)

		mux.Get("/test-route", func(w http.ResponseWriter, r *http.Request) {
			ctx := contexthandler.FromContext(r.Context())
			assert.NotNil(t, ctx)
			assert.NotNil(t, ctx.Context)
			assert.NotNil(t, ctx.Logger)

			w.WriteHeader(200)
			_, err := w.Write([]byte("ok"))
			require.NoError(t, err)
		})

		req := httptest.NewRequest("GET", "/test-route", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)
	})
}

func TestFrontendService_LoginErrorCookie(t *testing.T) {
	publicDir := setupTestWebAssets(t)
	cfg := &setting.Cfg{
		HTTPPort:               "3000",
		StaticRootPath:         publicDir,
		BuildVersion:           "10.3.0",
		OAuthLoginErrorMessage: "oauth.login.error",
		CookieSecure:           false,
		CookieSameSiteDisabled: false,
		CookieSameSiteMode:     http.SameSiteLaxMode,
	}

	t.Run("should detect login_error cookie and set generic error message", func(t *testing.T) {
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		// Set the login_error cookie (with some encrypted-looking value)
		req.AddCookie(&http.Cookie{
			Name:  "login_error",
			Value: "abc123encryptedvalue",
		})
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()

		// Check that the generic error message is in the response
		assert.Contains(t, body, "loginError", "Should contain loginError when cookie is present")
		assert.Contains(t, body, "oauth.login.error", "Should contain the generic OAuth error message")

		// Check that the cookie was deleted (MaxAge=-1)
		cookies := recorder.Result().Cookies()
		var foundDeletedCookie bool
		for _, cookie := range cookies {
			if cookie.Name == "login_error" {
				assert.Equal(t, -1, cookie.MaxAge, "Cookie should be deleted (MaxAge=-1)")
				assert.Equal(t, "", cookie.Value, "Cookie value should be empty")
				foundDeletedCookie = true
				break
			}
		}
		assert.True(t, foundDeletedCookie, "Should have set a cookie deletion header")
	})

	t.Run("should not set error when login_error cookie is absent", func(t *testing.T) {
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		// No login_error cookie
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()

		// The page should render but without the login error
		assert.Contains(t, body, "window.grafanaBootData")
		// Check that loginError is not set (or is empty/omitted in JSON)
		// Since it's omitempty, it shouldn't appear at all
		assert.NotContains(t, body, "loginError", "Should not contain loginError when cookie is absent")
	})

	t.Run("should handle custom OAuth error message from config", func(t *testing.T) {
		customCfg := &setting.Cfg{
			HTTPPort:               "3000",
			StaticRootPath:         publicDir,
			BuildVersion:           "10.3.0",
			OAuthLoginErrorMessage: "Oh no a boo-boo happened!",
			CookieSecure:           false,
			CookieSameSiteDisabled: false,
			CookieSameSiteMode:     http.SameSiteLaxMode,
		}
		service := createTestService(t, customCfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "login_error",
			Value: "abc123encryptedvalue",
		})
		recorder := httptest.NewRecorder()

		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()

		// Check that the custom error message is used
		assert.Contains(t, body, "Oh no a boo-boo happened!", "Should use custom OAuth error message from config")
	})
}

func TestFrontendService_IndexHooks(t *testing.T) {
	publicDir := setupTestWebAssets(t)
	cfg := &setting.Cfg{
		HTTPPort:       "3000",
		StaticRootPath: publicDir,
		BuildVersion:   "10.3.0",
	}

	t.Run("should handle hooks that modify buildInfo fields", func(t *testing.T) {
		service := createTestService(t, cfg)

		// Add a hook that modifies various buildInfo fields
		service.index.hooksService.AddIndexDataHook(func(indexData *dtos.IndexViewData, req *contextmodel.ReqContext) {
			indexData.Settings.BuildInfo.Version = "99.99.99"
			indexData.Settings.BuildInfo.VersionString = "Custom Edition v99.99.99 (custom)"
			indexData.Settings.BuildInfo.Edition = "custom-edition"
		})

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "99.99.99", "Hook should have modified the version")
		assert.Contains(t, body, "Custom Edition v99.99.99 (custom)", "Hook should have modified the version string")
		assert.Contains(t, body, "custom-edition", "Hook should have modified the edition")
	})

	t.Run("should work without any hooks registered", func(t *testing.T) {
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		body := recorder.Body.String()
		assert.Contains(t, body, "<div id=\"reactRoot\"></div>")
		// The build version comes from setting.BuildVersion (global), not cfg.BuildVersion
		// So we just check that the page renders successfully
		assert.Contains(t, body, "window.grafanaBootData")
	})
}

func TestFrontendService_CSP(t *testing.T) {
	publicDir := setupTestWebAssets(t)

	t.Run("should set CSP headers when enabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			BuildVersion:   "10.3.0",
			AppURL:         "https://grafana.example.com/grafana",
			CSPEnabled:     true,
			CSPTemplate:    "script-src 'self' $NONCE; style-src 'self' $ROOT_PATH",
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// Verify CSP header is set
		cspHeader := recorder.Header().Get("Content-Security-Policy")
		assert.NotEmpty(t, cspHeader, "CSP header should be set")
		assert.Contains(t, cspHeader, "script-src 'self' 'nonce-", "CSP should contain nonce")
		assert.Contains(t, cspHeader, "style-src 'self' grafana.example.com/grafana", "CSP should contain root path")
	})

	t.Run("should set CSP-Report-Only header when enabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:              "3000",
			StaticRootPath:        publicDir,
			BuildVersion:          "10.3.0",
			AppURL:                "https://grafana.example.com",
			CSPReportOnlyEnabled:  true,
			CSPReportOnlyTemplate: "default-src 'self' $NONCE",
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// Verify CSP-Report-Only header is set
		cspReportOnlyHeader := recorder.Header().Get("Content-Security-Policy-Report-Only")
		assert.NotEmpty(t, cspReportOnlyHeader, "CSP-Report-Only header should be set")
		assert.Contains(t, cspReportOnlyHeader, "default-src 'self' 'nonce-", "CSP-Report-Only should contain nonce")
	})

	t.Run("should set both CSP headers when both enabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:              "3000",
			StaticRootPath:        publicDir,
			BuildVersion:          "10.3.0",
			AppURL:                "https://grafana.example.com",
			CSPEnabled:            true,
			CSPTemplate:           "script-src 'self' $NONCE",
			CSPReportOnlyEnabled:  true,
			CSPReportOnlyTemplate: "default-src 'self'",
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// Verify both headers are set
		cspHeader := recorder.Header().Get("Content-Security-Policy")
		cspReportOnlyHeader := recorder.Header().Get("Content-Security-Policy-Report-Only")
		assert.NotEmpty(t, cspHeader, "CSP header should be set")
		assert.NotEmpty(t, cspReportOnlyHeader, "CSP-Report-Only header should be set")
	})

	t.Run("should not set CSP headers when disabled", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			BuildVersion:   "10.3.0",
			AppURL:         "https://grafana.example.com",
			CSPEnabled:     false,
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// Verify CSP headers are not set
		cspHeader := recorder.Header().Get("Content-Security-Policy")
		cspReportOnlyHeader := recorder.Header().Get("Content-Security-Policy-Report-Only")
		assert.Empty(t, cspHeader, "CSP header should not be set when disabled")
		assert.Empty(t, cspReportOnlyHeader, "CSP-Report-Only header should not be set when disabled")
	})

	t.Run("should store nonce in request context", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			BuildVersion:   "10.3.0",
			AppURL:         "https://grafana.example.com",
			CSPEnabled:     true,
			CSPTemplate:    "script-src 'self' $NONCE",
		}
		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)

		var capturedNonce string
		mux.Get("/test-nonce", func(w http.ResponseWriter, r *http.Request) {
			ctx := contexthandler.FromContext(r.Context())
			capturedNonce = ctx.RequestNonce
			w.WriteHeader(200)
		})

		req := httptest.NewRequest("GET", "/test-nonce", nil)
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)
		assert.NotEmpty(t, capturedNonce, "Nonce should be stored in request context")

		// Verify the nonce in context matches the one in the CSP header
		cspHeader := recorder.Header().Get("Content-Security-Policy")
		assert.Contains(t, cspHeader, "'nonce-"+capturedNonce+"'", "Nonce in header should match context nonce")
	})

	t.Run("should use base config when Tenant-ID header is present", func(t *testing.T) {
		cfg := &setting.Cfg{
			HTTPPort:       "3000",
			StaticRootPath: publicDir,
			BuildVersion:   "10.3.0",
			AppURL:         "https://grafana.example.com",
			CSPEnabled:     true,
			CSPTemplate:    "default-src 'self'", // Base CSP policy
		}

		service := createTestService(t, cfg)

		mux := web.New()
		service.addMiddlewares(mux)
		service.registerRoutes(mux)

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("Tenant-ID", "tenant-123") // Simulate tenant request
		recorder := httptest.NewRecorder()
		mux.ServeHTTP(recorder, req)

		assert.Equal(t, 200, recorder.Code)

		// Currently should still use base config (tenant overrides not yet implemented)
		cspHeader := recorder.Header().Get("Content-Security-Policy")
		assert.Contains(t, cspHeader, "default-src 'self'", "Should use base CSP for now")
	})
}
