package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/datasource"
	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	fakeDatasources "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var openfeatureTestMu sync.Mutex

func setupOpenFeatureFlag(t *testing.T, flagName string, enabled bool) {
	t.Helper()
	openfeatureTestMu.Lock()

	variant := "disabled"
	if enabled {
		variant = "enabled"
	}

	err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		flagName: {
			Key:            flagName,
			DefaultVariant: variant,
			Variants:       map[string]any{"enabled": true, "disabled": false},
		},
	}))
	require.NoError(t, err)

	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		openfeatureTestMu.Unlock()
	})
}

// implements datasource.ConnectionClient
type mockConnectionClient struct {
	result *queryV0.DataSourceConnectionList
	err    error
}

func (m *mockConnectionClient) GetConnectionByUID(_ context.Context, _ int64, _ string) (*queryV0.DataSourceConnectionList, error) {
	return m.result, m.err
}

var _ datasource.ConnectionClient = (*mockConnectionClient)(nil)

// implements grafanaapiserver.DirectRestConfigProvider
type mockDirectRestConfigProvider struct {
	transport         http.RoundTripper
	host              string
	lastServedPath    string
	lastServedMethod  string
	lastServedQuery   string
	lastServedHeaders http.Header
}

func (m *mockDirectRestConfigProvider) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Host:      m.host,
		Transport: m.transport,
	}
}

func (m *mockDirectRestConfigProvider) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.lastServedPath = r.URL.Path
	m.lastServedMethod = r.Method
	m.lastServedQuery = r.URL.RawQuery
	m.lastServedHeaders = r.Header.Clone()
	w.WriteHeader(http.StatusOK)
}

func (m *mockDirectRestConfigProvider) IsReady() bool { return true }

type mockRoundTripper struct {
	statusCode   int
	responseBody []byte
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	header := http.Header{}
	header.Set("Content-Type", "application/json")
	return &http.Response{
		StatusCode: m.statusCode,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader(m.responseBody)),
		Request:    req,
	}, nil
}

// These tests cover the failure scenarios for rerouting to the new /apis
// endpoints. They do not cover permissions - those are covered in
// datasources_test for legacy, and in the integration tests for the new
// endpoints.
func TestGetK8sDataSourceByUIDHandler(t *testing.T) {
	tests := []struct {
		name             string
		connectionResult *queryV0.DataSourceConnectionList
		connectionErr    error
		statusCode       int
		responseBody     []byte
		expectedCode     int
		expectedMessage  string
	}{
		{
			name:            "GetConnectionByUID error: not found",
			connectionErr:   errors.New("datasource connection not found"),
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name:            "GetConnectionByUID error: not authorized",
			connectionErr:   errors.New("forbidden"),
			expectedCode:    http.StatusInternalServerError,
			expectedMessage: "Failed to lookup datasource connection",
		},
		{
			name: "GetConnectionByUID: multiple connections returned",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{{Name: "a"}, {Name: "b"}},
			},
			expectedCode:    http.StatusConflict,
			expectedMessage: "duplicate datasource connections found with this name",
		},
		{
			name: "connection lookup succeeds, datasource not found",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			statusCode:      http.StatusNotFound,
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name: "connection lookup succeeds and data source found",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			statusCode: http.StatusOK,
			responseBody: []byte(`{
				"apiVersion": "prometheus.datasource.grafana.app/v0alpha1",
				"kind": "DataSource",
				"metadata": {"name": "test-uid", "namespace": "default"},
				"spec": {"title": "Test Prometheus", "url": "http://localhost:9090"}
			}`),
			expectedCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// not using SetupAPITestServer here because the access control is
			// overkill. Access control for these endpoints is tested in
			// datasources_test.go
			hs := &HTTPServer{
				Cfg: setting.NewCfg(),
				Features: featuremgmt.WithFeatures(
					featuremgmt.FlagDatasourcesRerouteLegacyCRUDAPIs,
					featuremgmt.FlagQueryService,
					featuremgmt.FlagDatasourceUseNewCRUDAPIs,
					featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint,
				),
				dsConnectionClient:   &mockConnectionClient{result: tt.connectionResult, err: tt.connectionErr},
				clientConfigProvider: &mockDirectRestConfigProvider{host: "http://localhost", transport: &mockRoundTripper{statusCode: tt.statusCode, responseBody: tt.responseBody}},
				namespacer:           func(int64) string { return "default" },
				DataSourcesService:   &dataSourcesServiceMock{},
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()

			sc := setupScenarioContext(t, "/api/datasources/uid/test-uid")
			handler := hs.getK8sDataSourceByUIDHandler()
			sc.m.Get("/api/datasources/uid/:uid", func(c *contextmodel.ReqContext) {
				c.Req = web.SetURLParams(c.Req, map[string]string{":uid": "test-uid"})
				c.SignedInUser = &user.SignedInUser{OrgID: 1}
				handler.(func(*contextmodel.ReqContext))(c)
			})
			sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

			assert.Equal(t, tt.expectedCode, sc.resp.Code)
			if tt.expectedMessage != "" {
				var body map[string]any
				require.NoError(t, json.Unmarshal(sc.resp.Body.Bytes(), &body))
				assert.Contains(t, body["message"], tt.expectedMessage)
			}
		})
	}
}

func newTestContext(t *testing.T, method, urlPath string, params map[string]string) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	t.Helper()
	req, err := http.NewRequest(method, urlPath, nil)
	require.NoError(t, err)
	req.Header.Set("Content-Type", "application/json")
	if params != nil {
		req = web.SetURLParams(req, params)
	}
	recorder := httptest.NewRecorder()
	ctx := &contextmodel.ReqContext{
		Context: &web.Context{
			Req:  req,
			Resp: web.NewResponseWriter(method, recorder),
		},
		SignedInUser: &user.SignedInUser{OrgID: 1},
		Logger:       log.New("test"),
	}
	return ctx, recorder
}

func TestCallK8sDataSourceResourceHandler_FlagDisabled(t *testing.T) {
	setupOpenFeatureFlag(t, featuremgmt.FlagDatasourcesApiserverEnableResourceEndpointRedirect, false)

	configProvider := &mockDirectRestConfigProvider{
		host:      "http://localhost",
		transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
	}
	hs := &HTTPServer{
		Cfg:                  setting.NewCfg(),
		Features:             featuremgmt.WithFeatures(),
		clientConfigProvider: configProvider,
		DataSourceCache:      &fakeDatasources.FakeCacheService{},
	}
	hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()

	ctx, recorder := newTestContext(t, http.MethodGet, "/api/datasources/uid/test-uid/resources", map[string]string{":uid": "test-uid", "*": ""})
	handler := hs.callK8sDataSourceResourceHandler()
	handler.(func(*contextmodel.ReqContext))(ctx)

	// The legacy handler should have been called (returning 500 from the fake cache
	// service since no datasources are configured), and the k8s path should be empty.
	assert.Empty(t, configProvider.lastServedPath, "expected no k8s redirect when flag is disabled")
	assert.Equal(t, http.StatusInternalServerError, recorder.Code)

	var body map[string]any
	require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
	assert.Equal(t, "Unable to load datasource meta data", body["message"],
		"expected legacy handler error, not a k8s redirect")
}

func TestCallK8sDataSourceResourceHandler(t *testing.T) {
	tests := []struct {
		name             string
		uid              string
		subPath          string
		queryParams      string
		connectionResult *queryV0.DataSourceConnectionList
		connectionErr    error
		expectedCode     int
		expectedMessage  string
		expectedK8sPath  string
	}{
		{
			name:            "invalid UID",
			uid:             "!!!invalid",
			expectedCode:    http.StatusBadRequest,
			expectedMessage: "UID is invalid",
		},
		{
			name:            "connection not found",
			uid:             "test-uid",
			connectionErr:   errors.New("datasource connection not found"),
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name:            "connection lookup error",
			uid:             "test-uid",
			connectionErr:   errors.New("forbidden"),
			expectedCode:    http.StatusInternalServerError,
			expectedMessage: "Failed to lookup datasource connection",
		},
		{
			name: "duplicate connections",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{{Name: "a"}, {Name: "b"}},
			},
			expectedCode:    http.StatusConflict,
			expectedMessage: "duplicate datasource connections found with this name",
		},
		{
			name: "empty connections",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{},
			},
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name: "proxies simple resource path",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "api/v1/labels",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/labels",
		},
		{
			name: "preserves query params on resource path",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "api/v1/query",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/query",
			queryParams:     "query=up&time=1234567890",
		},
		{
			name: "preserves encoded query params",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "api/v1/labels",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/labels",
			queryParams:     "match%5B%5D=up&start=1234567890&end=1234567899",
		},
		{
			name: "preserves encoded query values with special characters",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "api/v1/query",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/query",
			queryParams:     "query=rate%28http_requests_total%5B5m%5D%29&format=json",
		},
		{
			name: "preserves multiple query params on query_range",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "api/v1/query_range",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/query_range",
			queryParams:     "query=up&start=1614556800&end=1614643200&step=60",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagDatasourcesApiserverEnableResourceEndpointRedirect, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := &HTTPServer{
				Cfg:                  setting.NewCfg(),
				Features:             featuremgmt.WithFeatures(),
				dsConnectionClient:   &mockConnectionClient{result: tt.connectionResult, err: tt.connectionErr},
				clientConfigProvider: configProvider,
				namespacer:           func(int64) string { return "default" },
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()

			urlPath := "/api/datasources/uid/" + tt.uid + "/resources"
			if tt.subPath != "" {
				urlPath += "/" + tt.subPath
			}
			if tt.queryParams != "" {
				urlPath += "?" + tt.queryParams
			}
			params := map[string]string{":uid": tt.uid, "*": tt.subPath}

			ctx, recorder := newTestContext(t, http.MethodGet, urlPath, params)

			handler := hs.callK8sDataSourceResourceHandler()
			handler.(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, tt.expectedCode, recorder.Code)

			if tt.expectedMessage != "" {
				var body map[string]any
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
				assert.Equal(t, tt.expectedMessage, body["message"])
			}

			if tt.expectedK8sPath != "" {
				assert.Equal(t, tt.expectedK8sPath, configProvider.lastServedPath)
				assert.Equal(t, http.MethodGet, configProvider.lastServedMethod)
			}

			if tt.queryParams != "" {
				assert.Equal(t, tt.queryParams, configProvider.lastServedQuery,
					"query parameters should be preserved through the redirect")
			}
		})
	}
}

func TestCallK8sDataSourceResourceHandler_PreservesHTTPMethod(t *testing.T) {
	methods := []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodPatch}

	for _, method := range methods {
		t.Run(method, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagDatasourcesApiserverEnableResourceEndpointRedirect, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := &HTTPServer{
				Cfg:      setting.NewCfg(),
				Features: featuremgmt.WithFeatures(),
				dsConnectionClient: &mockConnectionClient{result: &queryV0.DataSourceConnectionList{
					Items: []queryV0.DataSourceConnection{
						{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
					},
				}},
				clientConfigProvider: configProvider,
				namespacer:           func(int64) string { return "default" },
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()

			ctx, recorder := newTestContext(t, method,
				"/api/datasources/uid/test-uid/resources/api/v1/query",
				map[string]string{":uid": "test-uid", "*": "api/v1/query"})

			handler := hs.callK8sDataSourceResourceHandler()
			handler.(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, http.StatusOK, recorder.Code)
			assert.Equal(t, method, configProvider.lastServedMethod,
				"HTTP method should be preserved through the proxy")
			assert.Equal(t,
				"/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/api/v1/query",
				configProvider.lastServedPath)
		})
	}
}

func TestCallK8sDataSourceResourceHandler_Headers(t *testing.T) {
	tests := []struct {
		name            string
		requestHeaders  map[string]string
		expectedPresent map[string]string
		expectedAbsent  []string
	}{
		{
			name: "preserves content-type header",
			requestHeaders: map[string]string{
				"Content-Type": "application/json",
			},
			expectedPresent: map[string]string{
				"Content-Type": "application/json",
			},
		},
		{
			name: "preserves accept header",
			requestHeaders: map[string]string{
				"Accept": "application/json, text/plain, */*",
			},
			expectedPresent: map[string]string{
				"Accept": "application/json, text/plain, */*",
			},
		},
		{
			name: "preserves authorization header",
			requestHeaders: map[string]string{
				"Authorization": "Bearer some-token",
			},
			expectedPresent: map[string]string{
				"Authorization": "Bearer some-token",
			},
		},
		{
			name: "preserves custom plugin headers",
			requestHeaders: map[string]string{
				"X-Datasource-Uid": "test-uid",
				"X-Plugin-Id":      "prometheus",
				"X-Custom-Header":  "custom-value",
			},
			expectedPresent: map[string]string{
				"X-Datasource-Uid": "test-uid",
				"X-Plugin-Id":      "prometheus",
				"X-Custom-Header":  "custom-value",
			},
		},
		{
			name: "preserves multiple headers simultaneously",
			requestHeaders: map[string]string{
				"Content-Type":  "application/x-www-form-urlencoded",
				"Authorization": "Bearer token-123",
				"Accept":        "application/json",
				"X-Request-Id":  "req-abc-123",
			},
			expectedPresent: map[string]string{
				"Content-Type":  "application/x-www-form-urlencoded",
				"Authorization": "Bearer token-123",
				"Accept":        "application/json",
				"X-Request-Id":  "req-abc-123",
			},
		},
		{
			name:           "headers not set on request are absent on proxy",
			requestHeaders: map[string]string{},
			expectedAbsent: []string{
				"Authorization",
				"X-Custom-Header",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagDatasourcesApiserverEnableResourceEndpointRedirect, true)

			configProvider := &mockDirectRestConfigProvider{
				host:      "http://localhost",
				transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
			}
			hs := &HTTPServer{
				Cfg:      setting.NewCfg(),
				Features: featuremgmt.WithFeatures(),
				dsConnectionClient: &mockConnectionClient{result: &queryV0.DataSourceConnectionList{
					Items: []queryV0.DataSourceConnection{
						{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
					},
				}},
				clientConfigProvider: configProvider,
				namespacer:           func(int64) string { return "default" },
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()

			ctx, recorder := newTestContext(t, http.MethodPost,
				"/api/datasources/uid/test-uid/resources/api/v1/query",
				map[string]string{":uid": "test-uid", "*": "api/v1/query"})

			for k, v := range tt.requestHeaders {
				ctx.Req.Header.Set(k, v)
			}

			handler := hs.callK8sDataSourceResourceHandler()
			handler.(func(*contextmodel.ReqContext))(ctx)

			require.Equal(t, http.StatusOK, recorder.Code)

			for key, expectedVal := range tt.expectedPresent {
				assert.Equal(t, expectedVal, configProvider.lastServedHeaders.Get(key),
					"header %q should be forwarded with value %q", key, expectedVal)
			}

			for _, key := range tt.expectedAbsent {
				assert.Empty(t, configProvider.lastServedHeaders.Get(key),
					"header %q should not be present on the proxied request", key)
			}
		})
	}
}

func TestPluginTypeFromConnection(t *testing.T) {
	assert.Equal(t, "prometheus", pluginTypeFromConnection(queryV0.DataSourceConnection{Plugin: "prometheus"}))
	assert.Equal(t, "loki", pluginTypeFromConnection(queryV0.DataSourceConnection{APIGroup: "loki.datasource.grafana.app"}))
	assert.Equal(t, "grafana-testdata-datasource", pluginTypeFromConnection(queryV0.DataSourceConnection{APIGroup: "grafana-testdata-datasource.datasource.grafana.app"}))
}

func TestCallK8sDataSourceHealthHandler(t *testing.T) {
	tests := []struct {
		name                string
		dsUID               string
		connectionResult    *queryV0.DataSourceConnectionList
		connectionErr       error
		expectedCode        int
		expectedMessage     string
		expectedForwardPath string
	}{
		{
			name:            "invalid UID returns 400",
			dsUID:           "not a valid uid!!",
			expectedCode:    http.StatusBadRequest,
			expectedMessage: "UID is invalid",
		},
		{
			name:            "GetConnectionByUID not found returns 404",
			dsUID:           "test-uid",
			connectionErr:   errors.New("datasource connection not found"),
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name:            "GetConnectionByUID generic error returns 500",
			dsUID:           "test-uid",
			connectionErr:   errors.New("some internal error"),
			expectedCode:    http.StatusInternalServerError,
			expectedMessage: "Failed to lookup datasource connection",
		},
		{
			name:  "duplicate connections returns 409",
			dsUID: "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{{Name: "a"}, {Name: "b"}},
			},
			expectedCode:    http.StatusConflict,
			expectedMessage: "duplicate datasource connections found with this name",
		},
		{
			name:  "valid connection forwards to k8s health path",
			dsUID: "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1", Plugin: "prometheus"},
				},
			},
			expectedCode:        http.StatusOK,
			expectedForwardPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/health",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, featuremgmt.FlagDatasourcesApiServerEnableHealthEndpointRedirect, true)

			configProvider := &mockDirectRestConfigProvider{host: "http://localhost"}
			hs := &HTTPServer{
				Cfg:                  setting.NewCfg(),
				Features:             featuremgmt.WithFeatures(),
				dsConnectionClient:   &mockConnectionClient{result: tt.connectionResult, err: tt.connectionErr},
				clientConfigProvider: configProvider,
				namespacer:           func(int64) string { return "default" },
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsEndpointRedirects = setupDsConfigHandlerMetrics()
			ctx, recorder := newTestContext(t, http.MethodGet, "/api/datasources/uid/"+tt.dsUID+"/health", map[string]string{":uid": tt.dsUID})
			handler := hs.callK8sDataSourceHealthHandler()
			handler.(func(*contextmodel.ReqContext))(ctx)

			assert.Equal(t, tt.expectedCode, recorder.Code)

			if tt.expectedMessage != "" {
				var body map[string]any
				require.NoError(t, json.Unmarshal(recorder.Body.Bytes(), &body))
				assert.Equal(t, tt.expectedMessage, body["message"])
			}

			if tt.expectedForwardPath != "" {
				assert.Equal(t, tt.expectedForwardPath, configProvider.lastServedPath)
			}
		})
	}
}
