package frontend

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"gopkg.in/ini.v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// setupTestContext creates a request with a proper context that includes a logger
func setupTestContext(r *http.Request, namespace string) *http.Request {
	logger := log.NewNopLogger()
	reqCtx := &contextmodel.ReqContext{
		Context: &web.Context{Req: r},
		Logger:  logger,
	}
	ctx := ctxkey.Set(r.Context(), reqCtx)
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}
	return r.WithContext(ctx)
}

var openfeatureTestMutex sync.Mutex

func enableSettingsOverridesToggle(t *testing.T) {
	t.Helper()
	openfeatureTestMutex.Lock()

	flag := memprovider.InMemoryFlag{
		Key:            featuremgmt.FlagFrontendServiceUseSettingsService,
		DefaultVariant: "on",
		Variants:       map[string]any{"on": true, "off": false},
	}

	err := featuremgmt.InitOpenFeature(featuremgmt.OpenFeatureConfig{
		ProviderType: setting.StaticProviderType,
		StaticFlags: map[string]memprovider.InMemoryFlag{
			featuremgmt.FlagFrontendServiceUseSettingsService: flag,
		},
	})
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

func TestRequestConfigMiddleware(t *testing.T) {
	t.Run("should store base config in request context", func(t *testing.T) {
		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, nil)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.True(t, capturedConfig.CSPEnabled)
		assert.Equal(t, capturedConfig.CSPTemplate, "default-src 'self'")
		assert.Equal(t, capturedConfig.AppURL, "https://grafana.example.com")
	})

	t.Run("should call next handler", func(t *testing.T) {
		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, nil)

		nextCalled := false
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.True(t, nextCalled, "Next handler should be called")
		assert.Equal(t, http.StatusOK, recorder.Code)
	})

	t.Run("should fetch and apply tenant overrides from settings service", func(t *testing.T) {
		enableSettingsOverridesToggle(t)

		// Create mock settings service that returns CSP overrides
		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{
				{Section: "security", Key: "content_security_policy", Value: "true"},
				{Section: "security", Key: "content_security_policy_template", Value: "script-src 'self'"},
			},
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		successBefore := testutil.ToFloat64(settingsFetchMetric.WithLabelValues("success"))

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Verify CSP overrides were applied
		assert.True(t, capturedConfig.CSPEnabled)
		assert.Equal(t, "script-src 'self'", capturedConfig.CSPTemplate)

		// Verify other settings remain at base values (not overridden)
		assert.Equal(t, "https://grafana.example.com", capturedConfig.AppURL)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)

		// Verify success metric was incremented
		assert.Equal(t, successBefore+1, testutil.ToFloat64(settingsFetchMetric.WithLabelValues("success")))
	})

	t.Run("should fallback to base config on settings service error", func(t *testing.T) {
		enableSettingsOverridesToggle(t)

		// Create mock that returns an error
		mockSettingsService := &mockSettingsService{
			err: assert.AnError,
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://base.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		errorBefore := testutil.ToFloat64(settingsFetchMetric.WithLabelValues("error"))

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Verify base config was used (no overrides)
		assert.Equal(t, "https://base.example.com", capturedConfig.AppURL)
		assert.True(t, capturedConfig.CSPEnabled)
		assert.Equal(t, "default-src 'self'", capturedConfig.CSPTemplate)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)

		// Verify error metric was incremented
		assert.Equal(t, errorBefore+1, testutil.ToFloat64(settingsFetchMetric.WithLabelValues("error")))
	})

	t.Run("should not call settings service when no namespace is present", func(t *testing.T) {
		enableSettingsOverridesToggle(t)

		mockSettingsService := &mockSettingsService{}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:      ini.Empty(),
			HTTPPort: "1234",
			AppURL:   "https://base.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "")
		// No baggage header
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.False(t, mockSettingsService.called)
	})

	t.Run("should not call settings service when feature toggle is disabled", func(t *testing.T) {
		// No call to enableSettingsOverridesToggle - toggle defaults to off
		mockSettingsService := &mockSettingsService{}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)

		// Settings service should not be called when toggle is off
		assert.False(t, mockSettingsService.called)

		// Base config should be used unchanged
		assert.True(t, capturedConfig.CSPEnabled)
		assert.Equal(t, "default-src 'self'", capturedConfig.CSPTemplate)
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
