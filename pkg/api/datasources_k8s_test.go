package api

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/api/datasource"
	queryV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

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
	transport http.RoundTripper
	host      string
}

func (m *mockDirectRestConfigProvider) GetDirectRestConfig(c *contextmodel.ReqContext) *clientrest.Config {
	return &clientrest.Config{
		Host:      m.host,
		Transport: m.transport,
	}
}

func (m *mockDirectRestConfigProvider) DirectlyServeHTTP(w http.ResponseWriter, r *http.Request) {}

// mockRoundTripper returns configurable responses based on HTTP method.
// For simple cases, set statusCode and responseBody for all methods.
// For method-specific responses, set getStatusCode/getResponseBody and putStatusCode/putResponseBody.
type mockRoundTripper struct {
	// Default response (used when method-specific fields are not set)
	statusCode   int
	responseBody []byte
	// Method-specific responses (optional)
	getStatusCode   int
	getResponseBody []byte
	putStatusCode   int
	putResponseBody []byte
}

func (m *mockRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	header := http.Header{}
	header.Set("Content-Type", "application/json")

	statusCode := m.statusCode
	body := m.responseBody

	switch req.Method {
	case http.MethodGet:
		if m.getStatusCode != 0 {
			statusCode = m.getStatusCode
			body = m.getResponseBody
		}
	case http.MethodPut:
		if m.putStatusCode != 0 {
			statusCode = m.putStatusCode
			body = m.putResponseBody
		}
	}

	return &http.Response{
		StatusCode: statusCode,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader(body)),
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
			hs.promRegister, hs.dsConfigHandlerRequestsDuration = setupDsConfigHandlerMetrics()

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

func TestUpdateDataSourceByUIDK8sHandler(t *testing.T) {
	tests := []struct {
		name             string
		connectionResult *queryV0.DataSourceConnectionList
		connectionErr    error
		getStatusCode    int
		getResponseBody  []byte
		putStatusCode    int
		putResponseBody  []byte
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
			name:            "GetConnectionByUID error: other error",
			connectionErr:   errors.New("internal error"),
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
			putStatusCode:   http.StatusNotFound,
			putResponseBody: []byte(`{"kind":"Status","apiVersion":"v1","metadata":{},"status":"Failure","message":"datasources \"test-uid\" not found","code":404}`),
			expectedCode:    http.StatusNotFound,
			expectedMessage: "Data source not found",
		},
		{
			name: "connection lookup succeeds, update fails with conflict",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1"},
				},
			},
			putStatusCode:   http.StatusConflict,
			putResponseBody: []byte(`{"kind":"Status","apiVersion":"v1","metadata":{},"status":"Failure","message":"conflict","code":409}`),
			expectedCode:    http.StatusConflict,
		},
		{
			name: "successful update",
			connectionResult: &queryV0.DataSourceConnectionList{
				Items: []queryV0.DataSourceConnection{
					{Name: "test-uid", APIGroup: "prometheus.datasource.grafana.app", APIVersion: "v0alpha1", Plugin: "prometheus"},
				},
			},
			putStatusCode: http.StatusOK,
			putResponseBody: []byte(`{
				"apiVersion": "prometheus.datasource.grafana.app/v0alpha1",
				"kind": "DataSource",
				"metadata": {"name": "test-uid", "namespace": "default", "resourceVersion": "2"},
				"spec": {"title": "Updated Prometheus", "url": "http://localhost:9090"}
			}`),
			expectedCode:    http.StatusOK,
			expectedMessage: "Datasource updated",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hs := &HTTPServer{
				Cfg: setting.NewCfg(),
				Features: featuremgmt.WithFeatures(
					featuremgmt.FlagDatasourcesRerouteLegacyCRUDAPIs,
					featuremgmt.FlagQueryService,
					featuremgmt.FlagQueryServiceWithConnections,
				),
				dsConnectionClient: &mockConnectionClient{result: tt.connectionResult, err: tt.connectionErr},
				clientConfigProvider: &mockDirectRestConfigProvider{
					host: "http://localhost",
					transport: &mockRoundTripper{
						getStatusCode:   tt.getStatusCode,
						getResponseBody: tt.getResponseBody,
						putStatusCode:   tt.putStatusCode,
						putResponseBody: tt.putResponseBody,
					},
				},
				namespacer:         func(int64) string { return "default" },
				DataSourcesService: &dataSourcesServiceMock{},
			}
			hs.promRegister, hs.dsConfigHandlerRequestsDuration = setupDsConfigHandlerMetrics()

			sc := setupScenarioContext(t, "/api/datasources/uid/test-uid")
			handler := hs.updateDataSourceByUIDK8sHandler()

			// Create request body
			updateCmd := map[string]any{
				"name":   "Updated Prometheus",
				"type":   "prometheus",
				"access": "proxy",
				"url":    "http://localhost:9090",
			}
			body, _ := json.Marshal(updateCmd)

			sc.m.Put("/api/datasources/uid/:uid", func(c *contextmodel.ReqContext) {
				c.Req = web.SetURLParams(c.Req, map[string]string{":uid": "test-uid"})
				c.Req.Body = io.NopCloser(bytes.NewReader(body))
				c.Req.Header.Set("Content-Type", "application/json")
				c.SignedInUser = &user.SignedInUser{OrgID: 1}
				handler.(func(*contextmodel.ReqContext))(c)
			})
			sc.fakeReqWithParams("PUT", sc.url, map[string]string{}).exec()

			assert.Equal(t, tt.expectedCode, sc.resp.Code)
			if tt.expectedMessage != "" {
				var respBody map[string]any
				require.NoError(t, json.Unmarshal(sc.resp.Body.Bytes(), &respBody))
				assert.Contains(t, respBody["message"], tt.expectedMessage)
			}
		})
	}
}
