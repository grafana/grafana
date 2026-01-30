package frontend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestContext creates a request with a proper context that includes a logger
func setupTestContext(r *http.Request) *http.Request {
	logger := log.NewNopLogger()
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{Req: r},
		Logger:  logger,
	}
	ctx := ctxkey.Set(r.Context(), reqCtx)
	return r.WithContext(ctx)
}

func TestRequestConfigMiddleware(t *testing.T) {
	t.Run("should store base config in request context", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				BuildInfo: dtos.FrontendSettingsBuildInfoDTO{
					Version: "10.3.0",
					Edition: "Open Source",
				},
				AnonymousEnabled: true,
			},
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(baseConfig, nil)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, baseConfig.CSPEnabled, capturedConfig.CSPEnabled)
		assert.Equal(t, baseConfig.CSPTemplate, capturedConfig.CSPTemplate)
		assert.Equal(t, baseConfig.AppURL, capturedConfig.AppURL)
		assert.Equal(t, baseConfig.AnonymousEnabled, capturedConfig.AnonymousEnabled)
		assert.Equal(t, baseConfig.BuildInfo.Version, capturedConfig.BuildInfo.Version)
		assert.Equal(t, baseConfig.BuildInfo.Edition, capturedConfig.BuildInfo.Edition)
	})

	t.Run("should call next handler", func(t *testing.T) {
		baseConfig := FSRequestConfig{}
		middleware := RequestConfigMiddleware(baseConfig, nil)

		nextCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.True(t, nextCalled, "Next handler should be called")
		assert.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("should work with minimal config", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{},
		}

		middleware := RequestConfigMiddleware(baseConfig, nil)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.Equal(t, false, capturedConfig.CSPEnabled)
		assert.Equal(t, "", capturedConfig.CSPTemplate)
	})

	t.Run("should fetch and apply tenant overrides from settings service", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				AnonymousEnabled: false,
				DisableLoginForm: false,
			},
			AppURL:     "https://base.example.com",
			CSPEnabled: false,
		}

		// Create mock settings service that returns CSP overrides
		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{
				{Section: "security", Key: "content_security_policy", Value: "true"},
				{Section: "security", Key: "content_security_policy_template", Value: "script-src 'self'"},
			},
		}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("baggage", "namespace=stacks-123")
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Verify CSP overrides were applied
		assert.True(t, capturedConfig.CSPEnabled)
		assert.Equal(t, "script-src 'self'", capturedConfig.CSPTemplate)

		// Verify other settings remain at base values (not overridden)
		assert.Equal(t, "https://base.example.com", capturedConfig.AppURL)
		assert.False(t, capturedConfig.AnonymousEnabled)
		assert.False(t, capturedConfig.DisableLoginForm)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)
	})

	t.Run("should fallback to base config on settings service error", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			AppURL:     "https://base.example.com",
			CSPEnabled: true,
		}

		// Create mock that returns an error
		mockSettingsService := &mockSettingsService{
			err: assert.AnError,
		}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req.Header.Set("baggage", "namespace=stacks-123")
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Verify base config was used (no overrides)
		assert.Equal(t, "https://base.example.com", capturedConfig.AppURL)
		assert.True(t, capturedConfig.CSPEnabled)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)
	})

	t.Run("should not call settings service without namespace header", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			AppURL: "https://base.example.com",
		}

		mockSettingsService := &mockSettingsService{}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req)
		// No baggage header
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.False(t, mockSettingsService.called)
	})

	t.Run("should parse namespace from baggage header with multiple values", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			FSFrontendSettings: FSFrontendSettings{
				AnonymousEnabled: false,
			},
			AppURL:     "https://base.example.com",
			CSPEnabled: false,
		}

		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{
				{Section: "security", Key: "content_security_policy", Value: "true"},
			},
		}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		// Baggage header with multiple key-value pairs
		req.Header.Set("baggage", "trace-id=abc123,namespace=tenant-456,user-id=xyz")
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.True(t, capturedConfig.CSPEnabled, "Should apply tenant overrides when namespace is present")
		assert.True(t, mockSettingsService.called, "Should call settings service when namespace is in baggage")
	})

	t.Run("should not call settings service with malformed baggage header", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			AppURL: "https://base.example.com",
		}

		mockSettingsService := &mockSettingsService{}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		// Malformed baggage header
		req.Header.Set("baggage", "invalid baggage format;;;")
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.False(t, mockSettingsService.called, "Should not call settings service with malformed baggage")
	})

	t.Run("should not call settings service when baggage has no namespace", func(t *testing.T) {
		baseConfig := FSRequestConfig{
			AppURL: "https://base.example.com",
		}

		mockSettingsService := &mockSettingsService{}

		middleware := RequestConfigMiddleware(baseConfig, mockSettingsService)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		// Baggage header without namespace key
		req.Header.Set("baggage", "trace-id=abc123,user-id=xyz")
		req = setupTestContext(req)
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.False(t, mockSettingsService.called, "Should not call settings service when namespace is not in baggage")
	})
}

// mockSettingsService is a simple mock for testing
type mockSettingsService struct {
	called   bool
	settings []*settingservice.Setting
	err      error
}

func (m *mockSettingsService) ListAsIni(ctx context.Context, selector metav1.LabelSelector) (*ini.File, error) {
	m.called = true
	if m.err != nil {
		return nil, m.err
	}

	// Convert settings to ini format (same logic as real service)
	conf := ini.Empty()
	for _, setting := range m.settings {
		if !conf.HasSection(setting.Section) {
			_, _ = conf.NewSection(setting.Section)
		}
		_, _ = conf.Section(setting.Section).NewKey(setting.Key, setting.Value)
	}
	return conf, nil
}

func (m *mockSettingsService) List(ctx context.Context, selector metav1.LabelSelector) ([]*settingservice.Setting, error) {
	m.called = true
	if m.err != nil {
		return nil, m.err
	}
	return m.settings, nil
}

// Implement prometheus.Collector interface
func (m *mockSettingsService) Describe(ch chan<- *prometheus.Desc) {}
func (m *mockSettingsService) Collect(ch chan<- prometheus.Metric) {}
