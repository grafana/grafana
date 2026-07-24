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
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/pluginscdn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	settingservice "github.com/grafana/grafana/pkg/services/setting"
	"github.com/grafana/grafana/pkg/services/user"
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

func enableSourceFilterToggle(t *testing.T) {
	t.Helper()
	openfeatureTestMutex.Lock()

	sourceFilterFlag := memprovider.InMemoryFlag{
		Key:            featuremgmt.FlagFrontendServiceSettingsSourceFilter,
		DefaultVariant: "on",
		Variants:       map[string]any{"on": true, "off": false},
	}

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagFrontendServiceSettingsSourceFilter: sourceFilterFlag,
	})
	require.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

func enableReducedBootDataToggle(t *testing.T) {
	t.Helper()
	openfeatureTestMutex.Lock()

	flag := memprovider.InMemoryFlag{
		Key:            featuremgmt.FlagFrontendServiceReducedBootDataAPI,
		DefaultVariant: "on",
		Variants:       map[string]any{"on": true, "off": false},
	}

	provider, err := featuremgmt.CreateStaticProviderWithStandardFlags(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagFrontendServiceReducedBootDataAPI: flag,
	})
	require.NoError(t, err)

	err = openfeature.SetProviderAndWait(provider)
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMutex.Unlock()
	})
}

// setupTestContextWithUser is like setupTestContext but attaches a SignedInUser,
// which GetBaseFrontendSettings dereferences when the reduced boot data flag is enabled.
func setupTestContextWithUser(r *http.Request, namespace string) *http.Request {
	reqCtx := &contextmodel.ReqContext{
		Context:      &web.Context{Req: r},
		SignedInUser: &user.SignedInUser{},
		Logger:       log.NewNopLogger(),
	}
	ctx := ctxkey.Set(r.Context(), reqCtx)
	if namespace != "" {
		ctx = request.WithNamespace(ctx, namespace)
	}
	return r.WithContext(ctx)
}

func TestRequestConfigMiddleware(t *testing.T) {
	t.Run("should store base config in request context", func(t *testing.T) {
		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, nil, nil)

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
		assert.Equal(t, capturedConfig.CSPTemplate, "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS")
		assert.Equal(t, capturedConfig.AppURL, "https://grafana.example.com")
	})

	t.Run("should call next handler", func(t *testing.T) {
		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, nil, nil)

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
		// Create mock settings service that returns CSP overrides
		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{
				{Section: "security", Key: "allow_embedding_hosts", Value: "wiki.example.com foo.example.com"},
			},
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS",
			AppURL:      "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService, nil)

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
		assert.Equal(t, []string{"wiki.example.com", "foo.example.com"}, capturedConfig.AllowEmbeddingHosts)

		// Verify other settings remain at base values (not overridden)
		assert.Equal(t, "https://grafana.example.com", capturedConfig.AppURL)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)

		// Verify success metric was incremented
		assert.Equal(t, successBefore+1, testutil.ToFloat64(settingsFetchMetric.WithLabelValues("success")))
	})

	t.Run("should fallback to base config on settings service error", func(t *testing.T) {
		// Create mock that returns an error
		mockSettingsService := &mockSettingsService{
			err: assert.AnError,
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:         ini.Empty(),
			HTTPPort:    "1234",
			CSPEnabled:  true,
			CSPTemplate: "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS",
			AppURL:      "https://base.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService, nil)

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
		assert.Equal(t, "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS", capturedConfig.CSPTemplate)

		// Verify settings service was called
		assert.True(t, mockSettingsService.called)

		// Verify error metric was incremented
		assert.Equal(t, errorBefore+1, testutil.ToFloat64(settingsFetchMetric.WithLabelValues("error")))
	})

	t.Run("should not call settings service when no namespace is present", func(t *testing.T) {
		mockSettingsService := &mockSettingsService{}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:      ini.Empty(),
			HTTPPort: "1234",
			AppURL:   "https://base.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService, nil)

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

	t.Run("should include source filter in selector when source filter toggle is enabled", func(t *testing.T) {
		enableSourceFilterToggle(t)

		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{},
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:      ini.Empty(),
			HTTPPort: "1234",
			AppURL:   "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService, nil)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.True(t, mockSettingsService.called)

		// Verify the selector uses source=us filter (replacing the NotIn defaults filter)
		require.Len(t, mockSettingsService.capturedSelector.MatchExpressions, 2)
		sourceFilter := mockSettingsService.capturedSelector.MatchExpressions[1]
		assert.Equal(t, "source", sourceFilter.Key)
		assert.Equal(t, metav1.LabelSelectorOpIn, sourceFilter.Operator)
		assert.Equal(t, []string{"us"}, sourceFilter.Values)
	})

	t.Run("should not include source filter in selector when source filter toggle is disabled", func(t *testing.T) {
		mockSettingsService := &mockSettingsService{
			settings: []*settingservice.Setting{},
		}

		license := &licensing.OSSLicensingService{}
		cfg := &setting.Cfg{
			Raw:      ini.Empty(),
			HTTPPort: "1234",
			AppURL:   "https://grafana.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, mockSettingsService, nil)

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContext(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		assert.True(t, mockSettingsService.called)

		// Verify the selector does NOT include a source=us filter (only 2 expressions)
		require.Len(t, mockSettingsService.capturedSelector.MatchExpressions, 2)
	})

	t.Run("populates full frontend settings and namespace when reduced boot data flag is enabled", func(t *testing.T) {
		enableReducedBootDataToggle(t)

		license := &licensing.OSSLicensingService{}
		cfg := setting.NewCfg()
		cfg.AppURL = "https://grafana.example.com"

		pluginsCDN := pluginscdn.ProvideService(&config.PluginManagementCfg{
			PluginsCDNURLTemplate: "https://cdn.example.com",
		})

		middleware := RequestConfigMiddleware(cfg, license, nil, pluginsCDN)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContextWithUser(req, "stacks-123")
		recorder := httptest.NewRecorder()

		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		require.NotNil(t, capturedConfig.FullFrontendSettings)
		assert.Equal(t, "https://grafana.example.com", capturedConfig.FullFrontendSettings.AppUrl)
		// Namespace is taken from the request baggage when the flag is enabled.
		assert.Equal(t, "stacks-123", capturedConfig.FullFrontendSettings.Namespace)
		// The plugins CDN base URL is sourced from the plugins CDN service.
		assert.Equal(t, "https://cdn.example.com", capturedConfig.FullFrontendSettings.PluginsCDNBaseURL)
	})

	t.Run("merges the per-request OpenFeature evaluation context into the base context when the reduced boot data flag is enabled", func(t *testing.T) {
		enableReducedBootDataToggle(t)

		license := &licensing.OSSLicensingService{}
		cfg := setting.NewCfg()
		cfg.AppURL = "https://grafana.example.com"
		// Base context attributes are configured globally and should be preserved.
		cfg.OpenFeature.ContextAttrs = map[string]string{
			"grafana_version": "12.0.0",
			"hostname":        "base.example.com",
		}

		middleware := RequestConfigMiddleware(cfg, license, nil, nil)

		var capturedConfig FSRequestConfig
		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var err error
			capturedConfig, err = FSRequestConfigFromContext(r.Context())
			require.NoError(t, err)
			w.WriteHeader(http.StatusOK)
		})

		handler := middleware(testHandler)

		req := httptest.NewRequest("GET", "/", nil)
		req = setupTestContextWithUser(req, "stacks-123")

		// Simulate the per-request evaluation context that the context middleware
		// sets earlier in the chain.
		evalCtx := openfeature.NewEvaluationContext("stacks-123", map[string]any{
			"namespace": "stacks-123",
			"hostname":  "foo.example.com",
		})
		req = req.WithContext(openfeature.MergeTransactionContext(req.Context(), evalCtx))

		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		assert.Equal(t, http.StatusOK, recorder.Code)
		require.NotNil(t, capturedConfig.FullFrontendSettings)
		assert.Equal(t, map[string]string{
			// Preserved from the base context.
			"grafana_version": "12.0.0",
			// Per-request value overrides the base context value.
			"hostname": "foo.example.com",
			// Added by the per-request context.
			"namespace": "stacks-123",
		}, capturedConfig.FullFrontendSettings.OpenFeatureContext)
	})
}

// mockSettingsService is a simple mock for testing
type mockSettingsService struct {
	called           bool
	capturedSelector metav1.LabelSelector
	settings         []*settingservice.Setting
	err              error
}

func (m *mockSettingsService) ListAsIni(ctx context.Context, selector metav1.LabelSelector) (*ini.File, error) {
	m.called = true
	m.capturedSelector = selector
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
