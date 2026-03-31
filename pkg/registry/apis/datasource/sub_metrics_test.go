package datasource

import (
	"context"
	"errors"
	"fmt"
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

// --- connectMetric unit tests ---

func TestConnectMetric_DefaultsToSuccess(t *testing.T) {
	const pid = "cm-default-plugin"
	before := counterVal("cm-default", pid, "success")

	m := newConnectMetric("cm-default", pid)
	m.Record()

	require.Equal(t, before+1, counterVal("cm-default", pid, "success"),
		"default status should be success")
}

func TestConnectMetric_SetError(t *testing.T) {
	const pid = "cm-seterr-plugin"
	beforeErr := counterVal("cm-seterr", pid, "error")
	beforeOK := counterVal("cm-seterr", pid, "success")

	m := newConnectMetric("cm-seterr", pid)
	m.SetError()
	m.Record()

	require.Equal(t, beforeErr+1, counterVal("cm-seterr", pid, "error"))
	require.Equal(t, beforeOK, counterVal("cm-seterr", pid, "success"),
		"success counter must not change")
}

func TestConnectMetric_SetNotFound(t *testing.T) {
	const pid = "cm-setnf-plugin"
	beforeNF := counterVal("cm-setnf", pid, "not_found")

	m := newConnectMetric("cm-setnf", pid)
	m.SetNotFound()
	m.Record()

	require.Equal(t, beforeNF+1, counterVal("cm-setnf", pid, "not_found"))
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

	require.Equal(t, before+1, counterVal("health", pid, "success"), "success counter should increment")
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

	require.Equal(t, before+1, counterVal("health", pid, "not_found"), "not_found counter should increment")
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

	require.Equal(t, before+1, counterVal("health", pid, "error"), "error counter should increment")
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

	require.Equal(t, before+3, counterVal("health", pid, "success"), "counter should increment once per Connect")
}

func TestHealthMetrics_NoDoubleCounting(t *testing.T) {
	const pid = "health-metrics-nodouble-plugin"
	beforeSuccess := counterVal("health", pid, "success")
	beforeError := counterVal("health", pid, "error")

	r := &subHealthREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockHealthClient{resp: &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: "unhealthy"}},
		datasources: &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
		contextProvider: &mockHealthContextProvider{
			pluginCtx: backend.PluginContext{GrafanaConfig: backend.NewGrafanaCfg(map[string]string{})},
		},
	}}

	handler, err := r.Connect(context.Background(), "ds1", nil, &mockHealthResponder{})
	require.NoError(t, err)
	require.NotNil(t, handler)

	// Exercise the handler to prove it does NOT record a second metric.
	recorder := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	handler.ServeHTTP(recorder, req)

	require.Equal(t, beforeSuccess+1, counterVal("health", pid, "success"),
		"non-OK health status is still a successful request — CheckHealth completed without error")
	require.Equal(t, beforeError, counterVal("health", pid, "error"),
		"error counter must NOT increment for a non-OK health status")
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

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.Equal(t, before+1, counterVal("resource", pid, "success"), "success counter should increment")
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

	require.Equal(t, before+1, counterVal("resource", pid, "not_found"))
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

	handler, err := r.Connect(context.Background(), "ds1", nil, &resourceMockResponder{})
	require.NoError(t, err)

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.Equal(t, before+1, counterVal("resource", pid, "error"), "error counter should increment on failure")
}

func TestResourceMetrics_DeferredInsideHandler(t *testing.T) {
	const pid = "resource-metrics-deferred-plugin"

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

	require.Equal(t, beforeConnect, counterVal("resource", pid, "success"),
		"success counter must NOT increment after Connect — only after ServeHTTP")

	req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resources/some/path", nil)
	handler.ServeHTTP(httptest.NewRecorder(), req)

	require.Equal(t, beforeConnect+1, counterVal("resource", pid, "success"),
		"success counter should increment after ServeHTTP completes")
}

// --- query metrics ---

func TestQueryMetrics_NotFound(t *testing.T) {
	const pid = "query-metrics-notfound-plugin"
	before := counterVal("query", pid, "not_found")

	r := &subQueryREST{builder: &DataSourceAPIBuilder{
		pluginJSON:      plugins.JSONData{ID: pid},
		client:          mockClient{lastCalledWithHeaders: &map[string]string{}},
		datasources:     mockDatasources{},
		contextProvider: mockContextProvider{},
	}}

	handler, err := r.Connect(context.Background(), "dsname-that-does-not-exist", nil, mockResponder{})
	require.Error(t, err)
	require.Nil(t, handler)

	require.Equal(t, before+1, counterVal("query", pid, "not_found"), "not_found counter should increment")
}

func TestQueryMetrics_ContextError(t *testing.T) {
	const pid = "query-metrics-ctxerr-plugin"
	before := counterVal("query", pid, "error")

	r := &subQueryREST{builder: &DataSourceAPIBuilder{
		pluginJSON:  plugins.JSONData{ID: pid},
		client:      mockClient{lastCalledWithHeaders: &map[string]string{}},
		datasources: &mockHealthDatasourceProvider{instanceSettingsErr: fmt.Errorf("connection refused")},
		contextProvider: &mockHealthContextProvider{
			pluginCtxErr: fmt.Errorf("connection refused"),
		},
	}}

	handler, err := r.Connect(context.Background(), "ds1", nil, mockResponder{})
	require.Error(t, err)
	require.Nil(t, handler)

	require.Equal(t, before+1, counterVal("query", pid, "error"), "error counter should increment")
}
