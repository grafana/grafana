package api

import (
	"net/http"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// setupPluginEndpointMetrics builds a fresh prometheus registry + pluginEndpointRedirects
// counter for isolated tests.
func setupPluginEndpointMetrics() (prometheus.Registerer, prometheus.Collector, *prometheus.CounterVec) {
	promRegister := prometheus.NewRegistry()
	pluginEndpointRedirects := prometheus.NewCounterVec(prometheus.CounterOpts{
		Namespace: "grafana",
		Name:      "plugin_endpoint_redirects_total",
		Help:      "Total number of app plugin endpoint redirects by route and target (legacy/remote)",
	}, []string{"route", "target"})
	promRegister.MustRegister(pluginEndpointRedirects)
	return promRegister, nil, pluginEndpointRedirects
}

func TestCallK8sAppPluginResourceHandler(t *testing.T) {
	tests := []struct {
		name            string
		pluginID        string
		subPath         string
		queryParams     string
		expectedCode    int
		expectedK8sPath string
	}{
		{
			name:            "missing pluginId returns bad request",
			pluginID:        "",
			expectedCode:    http.StatusBadRequest,
			expectedK8sPath: "",
		},
		{
			name:            "proxies simple resource path",
			pluginID:        "grafana-oncall-app",
			subPath:         "features/",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/resources/features/",
		},
		{
			name:            "proxies resource root without sub-path",
			pluginID:        "grafana-oncall-app",
			subPath:         "",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/resources",
		},
		{
			name:            "preserves query params",
			pluginID:        "grafana-oncall-app",
			subPath:         "alert_receive_channels/",
			queryParams:     "filters=true&integration=grafana_alerting",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/resources/alert_receive_channels/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagPluginsUseMTPluginBackend, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := newAppPluginTestServer(configProvider)

			urlPath := "/api/plugins/" + tt.pluginID + "/resources"
			if tt.subPath != "" {
				urlPath += "/" + tt.subPath
			}
			if tt.queryParams != "" {
				urlPath += "?" + tt.queryParams
			}
			params := map[string]string{":pluginId": tt.pluginID, "*": tt.subPath}

			ctx, recorder := newTestContext(t, http.MethodGet, urlPath, params)

			hs.callK8sAppPluginResourceHandler().(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, tt.expectedCode, recorder.Code)
			assert.Equal(t, tt.expectedK8sPath, configProvider.lastServedPath)
			if tt.queryParams != "" {
				assert.Equal(t, tt.queryParams, configProvider.lastServedQuery)
			}
		})
	}
}

func TestCallK8sAppPluginResourceHandler_PreservesHTTPMethod(t *testing.T) {
	methods := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagPluginsUseMTPluginBackend, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := newAppPluginTestServer(configProvider)

			params := map[string]string{":pluginId": "grafana-oncall-app", "*": "features/"}
			ctx, recorder := newTestContext(t, method, "/api/plugins/grafana-oncall-app/resources/features/", params)

			hs.callK8sAppPluginResourceHandler().(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, method, configProvider.lastServedMethod)
		})
	}
}

func TestCallK8sAppPluginHealthHandler(t *testing.T) {
	tests := []struct {
		name            string
		pluginID        string
		expectedCode    int
		expectedK8sPath string
	}{
		{
			name:         "missing pluginId returns bad request",
			pluginID:     "",
			expectedCode: http.StatusBadRequest,
		},
		{
			name:            "proxies health check",
			pluginID:        "grafana-oncall-app",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/health",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagPluginsUseMTPluginBackend, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := newAppPluginTestServer(configProvider)

			urlPath := "/api/plugins/" + tt.pluginID + "/health"
			params := map[string]string{":pluginId": tt.pluginID}
			ctx, recorder := newTestContext(t, http.MethodGet, urlPath, params)

			hs.callK8sAppPluginHealthHandler().(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, tt.expectedCode, recorder.Code)
			assert.Equal(t, tt.expectedK8sPath, configProvider.lastServedPath)
		})
	}
}

func TestCallK8sAppPluginProxyHandler(t *testing.T) {
	tests := []struct {
		name            string
		pluginID        string
		subPath         string
		expectedCode    int
		expectedK8sPath string
	}{
		{
			name:            "proxies simple proxy path",
			pluginID:        "grafana-oncall-app",
			subPath:         "some/upstream/path",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/proxy/some/upstream/path",
		},
		{
			name:            "proxies proxy root without sub-path",
			pluginID:        "grafana-oncall-app",
			subPath:         "",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/grafana-oncall-app/v0alpha1/namespaces/default/app/instance/proxy",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagPluginsUseMTPluginBackend, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := newAppPluginTestServer(configProvider)

			urlPath := "/api/plugin-proxy/" + tt.pluginID
			if tt.subPath != "" {
				urlPath += "/" + tt.subPath
			}
			params := map[string]string{":pluginId": tt.pluginID, "*": tt.subPath}
			ctx, recorder := newTestContext(t, http.MethodGet, urlPath, params)

			hs.callK8sAppPluginProxyHandler().(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, tt.expectedCode, recorder.Code)
			assert.Equal(t, tt.expectedK8sPath, configProvider.lastServedPath)
		})
	}
}

func TestCallK8sAppPluginHandlers_FlagDisabled(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagPluginsUseMTPluginBackend, false)

	configProvider := &mockDirectRestConfigProvider{
		host:      "http://localhost",
		transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
	}
	hs := newAppPluginTestServer(configProvider)

	// With the flag off, the redirect must NOT touch the config provider.
	// The legacy handlers require plugin store / settings / plugin context provider — we
	// don't wire those, so calls will error out. That's fine: we only need to prove the
	// K8s path was never set.
	t.Run("resources", func(t *testing.T) {
		defer func() { _ = recover() }() // legacy handler may panic on missing deps
		params := map[string]string{":pluginId": "grafana-oncall-app", "*": ""}
		ctx, _ := newTestContext(t, http.MethodGet, "/api/plugins/grafana-oncall-app/resources", params)
		hs.callK8sAppPluginResourceHandler().(func(*contextmodel.ReqContext))(ctx)
		assert.Empty(t, configProvider.lastServedPath)
	})

	t.Run("health", func(t *testing.T) {
		defer func() { _ = recover() }()
		params := map[string]string{":pluginId": "grafana-oncall-app"}
		ctx, _ := newTestContext(t, http.MethodGet, "/api/plugins/grafana-oncall-app/health", params)
		hs.callK8sAppPluginHealthHandler().(func(*contextmodel.ReqContext))(ctx)
		assert.Empty(t, configProvider.lastServedPath)
	})

	t.Run("proxy", func(t *testing.T) {
		defer func() { _ = recover() }()
		params := map[string]string{":pluginId": "grafana-oncall-app", "*": ""}
		ctx, _ := newTestContext(t, http.MethodGet, "/api/plugin-proxy/grafana-oncall-app", params)
		hs.callK8sAppPluginProxyHandler().(func(*contextmodel.ReqContext))(ctx)
		assert.Empty(t, configProvider.lastServedPath)
	})
}

// newAppPluginTestServer builds an HTTPServer with just the fields needed to exercise
// the app-plugin redirect handlers.
func newAppPluginTestServer(configProvider *mockDirectRestConfigProvider) *HTTPServer {
	hs := &HTTPServer{
		Cfg:                  setting.NewCfg(),
		Features:             featuremgmt.WithFeatures(),
		clientConfigProvider: configProvider,
		namespacer:           func(int64) string { return "default" },
	}
	_, _, hs.pluginEndpointRedirects = setupPluginEndpointMetrics()
	return hs
}
