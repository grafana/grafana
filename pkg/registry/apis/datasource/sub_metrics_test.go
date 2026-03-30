package datasource

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func counterVal(endpoint, pluginID, status string) float64 {
	return testutil.ToFloat64(dsSubresourceRequests.WithLabelValues(endpoint, pluginID, status))
}

// --- health metrics ---

func TestHealthMetrics_Success(t *testing.T) {
	const pid = "health-metrics-success-plugin"
	before := counterVal("health", pid, "success")

	r := &subHealthREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockHealthClient{resp: &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "ok"}},
		datasources: &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
		contextProvider: &mockHealthContextProvider{
			pluginCtx: backend.PluginContext{GrafanaConfig: backend.NewGrafanaCfg(map[string]string{})},
		},
	}}

	handler, err := r.Connect(context.Background(), "ds1", nil, &mockHealthResponder{})
	require.NoError(t, err)
	require.NotNil(t, handler)

	after := counterVal("health", pid, "success")
	require.Equal(t, before+1, after, "success counter should increment once per Connect call")
}

func TestHealthMetrics_NotFound(t *testing.T) {
	const pid = "health-metrics-notfound-plugin"
	before := counterVal("health", pid, "not_found")

	r := &subHealthREST{builder: &DataSourceAPIBuilder{
		pluginJSON:      plugins.JSONData{ID: pid},
		client:          mockHealthClient{},
		datasources:     &mockHealthDatasourceProvider{instanceSettingsErr: datasources.ErrDataSourceNotFound},
		contextProvider: &mockHealthContextProvider{},
	}}

	handler, err := r.Connect(context.Background(), "missing", nil, &mockHealthResponder{})
	require.Error(t, err)
	require.Nil(t, handler)

	after := counterVal("health", pid, "not_found")
	require.Equal(t, before+1, after, "not_found counter should increment when datasource is missing")
}

func TestHealthMetrics_Error(t *testing.T) {
	const pid = "health-metrics-error-plugin"
	before := counterVal("health", pid, "error")

	r := &subHealthREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockHealthClient{err: errors.New("check failed")},
		datasources: &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
		contextProvider: &mockHealthContextProvider{
			pluginCtx: backend.PluginContext{GrafanaConfig: backend.NewGrafanaCfg(map[string]string{})},
		},
	}}

	handler, err := r.Connect(context.Background(), "ds1", nil, &mockHealthResponder{})
	require.Error(t, err)
	require.Nil(t, handler)

	after := counterVal("health", pid, "error")
	require.Equal(t, before+1, after, "error counter should increment on CheckHealth failure")
}

func TestHealthMetrics_MultipleCallsIncrement(t *testing.T) {
	const pid = "health-metrics-multi-plugin"
	before := counterVal("health", pid, "success")

	r := &subHealthREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockHealthClient{resp: &backend.CheckHealthResult{Status: backend.HealthStatusOk}},
		datasources: &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
		contextProvider: &mockHealthContextProvider{
			pluginCtx: backend.PluginContext{GrafanaConfig: backend.NewGrafanaCfg(map[string]string{})},
		},
	}}

	for i := 0; i < 3; i++ {
		_, err := r.Connect(context.Background(), "ds1", nil, &mockHealthResponder{})
		require.NoError(t, err)
	}

	after := counterVal("health", pid, "success")
	require.Equal(t, before+3, after, "counter should increment once per Connect invocation")
}

// --- resource metrics ---

func TestResourceMetrics_Success(t *testing.T) {
	const pid = "resource-metrics-success-plugin"
	before := counterVal("resource", pid, "success")

	mockClient := &resourceMockClient{
		callResourceFunc: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: []byte("ok")})
		},
	}

	r := &subResourceREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockClient,
		datasources: &resourceMockDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{UID: "ds1"}},
		contextProvider: &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		},
	}}

	handler, err := r.Connect(context.Background(), "ds1", nil, &resourceMockResponder{})
	require.NoError(t, err)
	require.NotNil(t, handler)

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	after := counterVal("resource", pid, "success")
	require.Equal(t, before+1, after, "success counter should increment after handler serves successfully")
}

func TestResourceMetrics_NotFound(t *testing.T) {
	const pid = "resource-metrics-notfound-plugin"
	before := counterVal("resource", pid, "not_found")

	r := &subResourceREST{builder: &DataSourceAPIBuilder{
		pluginJSON:      plugins.JSONData{ID: pid},
		client:          &resourceMockClient{},
		datasources:     &resourceMockDatasourceProvider{instanceSettingsErr: datasources.ErrDataSourceNotFound},
		contextProvider: &resourceMockContextProvider{},
	}}

	handler, err := r.Connect(context.Background(), "missing", nil, &resourceMockResponder{})
	require.Error(t, err)
	require.Nil(t, handler)

	after := counterVal("resource", pid, "not_found")
	require.Equal(t, before+1, after, "not_found counter should increment in Connect outer scope")
}

func TestResourceMetrics_CallResourceError(t *testing.T) {
	const pid = "resource-metrics-callerr-plugin"
	before := counterVal("resource", pid, "error")

	mockClient := &resourceMockClient{
		callResourceFunc: func(_ context.Context, _ *backend.CallResourceRequest, _ backend.CallResourceResponseSender) error {
			return errors.New("plugin error")
		},
	}

	r := &subResourceREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockClient,
		datasources: &resourceMockDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{UID: "ds1"}},
		contextProvider: &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		},
	}}

	responder := &resourceMockResponder{}
	handler, err := r.Connect(context.Background(), "ds1", nil, responder)
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	after := counterVal("resource", pid, "error")
	require.Equal(t, before+1, after, "error counter should increment inside handler on CallResource failure")
}

func TestResourceMetrics_SuccessCounterOnlyAfterServe(t *testing.T) {
	const pid = "resource-metrics-lazy-plugin"

	mockClient := &resourceMockClient{
		callResourceFunc: func(_ context.Context, _ *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
			return sender.Send(&backend.CallResourceResponse{Status: http.StatusOK, Body: []byte("ok")})
		},
	}

	r := &subResourceREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockClient,
		datasources: &resourceMockDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{UID: "ds1"}},
		contextProvider: &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		},
	}}

	beforeConnect := counterVal("resource", pid, "success")

	handler, err := r.Connect(context.Background(), "ds1", nil, &resourceMockResponder{})
	require.NoError(t, err)

	afterConnect := counterVal("resource", pid, "success")
	require.Equal(t, beforeConnect, afterConnect,
		"success counter must NOT increment after Connect — only after the handler serves the request")

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	afterServe := counterVal("resource", pid, "success")
	require.Equal(t, beforeConnect+1, afterServe,
		"success counter should increment after ServeHTTP completes")
}
