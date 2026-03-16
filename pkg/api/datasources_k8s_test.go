package api

import (
	"bytes"
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

func (m *mockConnectionClient) GetConnectionByUID(_ *contextmodel.ReqContext, _ string) (*queryV0.DataSourceConnectionList, error) {
	return m.result, m.err
}

var _ datasource.ConnectionClient = (*mockConnectionClient)(nil)

// implements grafanaapiserver.DirectRestConfigProvider
type mockDirectRestConfigProvider struct {
	transport        http.RoundTripper
	host             string
	lastServedPath   string
	lastServedMethod string
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
					featuremgmt.FlagQueryServiceWithConnections,
					featuremgmt.FlagDatasourcesApiServerEnableResourceEndpoint,
				),
				dsConnectionClient:   &mockConnectionClient{result: tt.connectionResult, err: tt.connectionErr},
				clientConfigProvider: &mockDirectRestConfigProvider{host: "http://localhost", transport: &mockRoundTripper{statusCode: tt.statusCode, responseBody: tt.responseBody}},
				namespacer:           func(int64) string { return "default" },
				DataSourcesService:   &dataSourcesServiceMock{},
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsResourceEndpointRequests = setupDsConfigHandlerMetrics()

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

func newResourceTestContext(t *testing.T, method, path string, params map[string]string) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	t.Helper()
	req, err := http.NewRequest(method, path, nil)
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
	setupOpenFeatureFlag(t, flagDatasourceResourceEndpointRedirect, false)

	configProvider := &mockDirectRestConfigProvider{
		host:      "http://localhost",
		transport: &mockRoundTripper{statusCode: http.StatusOK, responseBody: []byte(`{}`)},
	}
	hs := &HTTPServer{
		Cfg:                 setting.NewCfg(),
		Features:            featuremgmt.WithFeatures(),
		clientConfigProvider: configProvider,
	}
	hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsResourceEndpointRequests = setupDsConfigHandlerMetrics()

	handler := hs.callK8sDataSourceResourceHandler()

	// The handler is always a closure now; flag is evaluated per-request.
	assert.IsType(t, (func(*contextmodel.ReqContext))(nil), handler,
		"expected closure handler type")

	// When the flag is disabled, no redirect should occur (k8s path should not be set).
	assert.Empty(t, configProvider.lastServedPath,
		"expected no k8s redirect when flag is disabled")
}

func TestCallK8sDataSourceResourceHandler(t *testing.T) {
	tests := []struct {
		name             string
		uid              string
		subPath          string
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
			name: "proxies to k8s resource endpoint with sub-path",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			subPath:         "some/path",
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources/some/path",
		},
		{
			name: "proxies to k8s resource endpoint without sub-path",
			uid:  "test-uid",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			expectedCode:    http.StatusOK,
			expectedK8sPath: "/apis/prometheus.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-uid/resources",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			setupOpenFeatureFlag(t, flagDatasourceResourceEndpointRedirect, true)

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
			hs.promRegister, hs.dsConfigHandlerRequestsDuration, hs.dsResourceEndpointRequests = setupDsConfigHandlerMetrics()

			urlPath := "/api/datasources/uid/" + tt.uid + "/resources"
			if tt.subPath != "" {
				urlPath += "/" + tt.subPath
			}
			params := map[string]string{":uid": tt.uid, "*": tt.subPath}

			ctx, recorder := newResourceTestContext(t, http.MethodGet, urlPath, params)

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
		})
	}
}
