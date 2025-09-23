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

	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

// Helper function to create a test service with minimal configuration
func createTestService(t *testing.T, cfg *setting.Cfg) *frontendService {
	t.Helper()

	features := featuremgmt.WithFeatures()
	license := &licensing.OSSLicensingService{}

	var promRegister prometheus.Registerer = prometheus.NewRegistry()
	promGatherer := promRegister.(*prometheus.Registry)

	if cfg.BuildVersion == "" {
		cfg.BuildVersion = "10.3.0"
	}

	service, err := ProvideFrontendService(cfg, features, promGatherer, promRegister, license)
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
