package datasource

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type mockHealthClient struct {
	resp            *backend.CheckHealthResult
	err             error
	checkHealthFunc func(context.Context, *backend.CheckHealthRequest) (*backend.CheckHealthResult, error)
}

func (m mockHealthClient) CallResource(context.Context, *backend.CallResourceRequest, backend.CallResourceResponseSender) error {
	return nil
}

func (m mockHealthClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if m.checkHealthFunc != nil {
		return m.checkHealthFunc(ctx, req)
	}
	if m.err != nil {
		return nil, m.err
	}
	return m.resp, nil
}

func (m mockHealthClient) ConvertObjects(context.Context, *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return nil, nil
}

func (m mockHealthClient) QueryChunkedData(context.Context, *backend.QueryChunkedDataRequest, backend.ChunkedDataWriter) error {
	return nil
}

func (m mockHealthClient) QueryData(context.Context, *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, nil
}

type mockHealthDatasourceProvider struct {
	instanceSettings    *backend.DataSourceInstanceSettings
	instanceSettingsErr error
}

func (m *mockHealthDatasourceProvider) CreateDataSource(context.Context, *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	return nil, nil
}

func (m *mockHealthDatasourceProvider) DeleteDataSource(context.Context, string) error {
	return nil
}

func (m *mockHealthDatasourceProvider) GetDataSource(context.Context, string) (*datasourceV0.DataSource, error) {
	return nil, nil
}

func (m *mockHealthDatasourceProvider) GetInstanceSettings(context.Context, string) (*backend.DataSourceInstanceSettings, error) {
	return m.instanceSettings, m.instanceSettingsErr
}

func (m *mockHealthDatasourceProvider) ListDataSources(context.Context) (*datasourceV0.DataSourceList, error) {
	return nil, nil
}

func (m *mockHealthDatasourceProvider) UpdateDataSource(context.Context, *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	return nil, nil
}

type mockHealthContextProvider struct {
	pluginCtx    backend.PluginContext
	pluginCtxErr error
}

func (m *mockHealthContextProvider) PluginContextForDataSource(context.Context, *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return m.pluginCtx, m.pluginCtxErr
}

type mockHealthResponder struct {
	statusCode int
	obj        runtime.Object
	err        error
}

func (r *mockHealthResponder) Object(statusCode int, obj runtime.Object) {
	r.statusCode = statusCode
	r.obj = obj
}

func (r *mockHealthResponder) Error(err error) {
	r.err = err
}

func TestSubHealthREST_Connect(t *testing.T) {
	t.Run("returns error when GetInstanceSettings fails", func(t *testing.T) {
		builder := &DataSourceAPIBuilder{
			datasources:     &mockHealthDatasourceProvider{instanceSettingsErr: datasources.ErrDataSourceNotFound},
			contextProvider: &mockHealthContextProvider{},
			client:          mockHealthClient{},
		}
		r := &subHealthREST{builder: builder}

		responder := &mockHealthResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.Error(t, err)
		require.Nil(t, handler)
		require.Contains(t, err.Error(), "\"test-ds\" not found")
	})

	t.Run("returns error when PluginContextForDataSource fails", func(t *testing.T) {
		builder := &DataSourceAPIBuilder{
			datasources: &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{
				UID:  "test-ds",
				Name: "Test Datasource",
			}},
			contextProvider: &mockHealthContextProvider{pluginCtxErr: errors.New("failed to create plugin context")},
			client:          mockHealthClient{},
		}
		r := &subHealthREST{builder: builder}

		responder := &mockHealthResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.Error(t, err)
		require.Nil(t, handler)
		require.Contains(t, err.Error(), "failed to create plugin context")
	})

	t.Run("returns error when CheckHealth fails", func(t *testing.T) {
		builder := &DataSourceAPIBuilder{
			datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
			contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			client:          mockHealthClient{err: errors.New("test")},
		}
		r := &subHealthREST{builder: builder}

		responder := &mockHealthResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.Error(t, err)
		require.Nil(t, handler)
		require.Contains(t, err.Error(), "test")
	})
}

func TestSubHealthREST_HandlerMapsResponse(t *testing.T) {
	t.Run("non-OK status returns 400 and includes details", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{
						Status:      backend.HealthStatusError,
						Message:     "unhealthy",
						JSONDetails: []byte(`{"reason":"nope"}`),
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(recorder, req)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusBadRequest, responder.statusCode)

		got, ok := responder.obj.(*datasourceV0.HealthCheckResult)
		require.True(t, ok, "expected HealthCheckResult, got: %#v", responder.obj)
		require.Equal(t, int(backend.HealthStatusError), got.Code)
		require.Equal(t, backend.HealthStatusError.String(), got.Status)
		require.Equal(t, "unhealthy", got.Message)
		require.NotNil(t, got.Details)
		require.Equal(t, map[string]any{"reason": "nope"}, got.Details.Object)
	})

	t.Run("invalid JSONDetails calls responder.Error", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{
						Status:      backend.HealthStatusOk,
						Message:     "ok",
						JSONDetails: []byte(`{not-json`),
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(recorder, req)

		require.Error(t, responder.err)
		require.Equal(t, 0, responder.statusCode)
		require.Nil(t, responder.obj)
	})

	t.Run("OK status returns 200 and maps result", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{
						Status:      backend.HealthStatusOk,
						Message:     "database connection OK",
						JSONDetails: []byte(`{"version":"1.0"}`),
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(recorder, req)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.statusCode)
		got, ok := responder.obj.(*datasourceV0.HealthCheckResult)
		require.True(t, ok)
		require.Equal(t, int(backend.HealthStatusOk), got.Code)
		require.Equal(t, backend.HealthStatusOk.String(), got.Status)
		require.Equal(t, "database connection OK", got.Message)
		require.NotNil(t, got.Details)
		require.Equal(t, map[string]any{"version": "1.0"}, got.Details.Object)
	})

	t.Run("OK status with no JSONDetails does not error", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{
						Status:      backend.HealthStatusOk,
						Message:     "ok",
						JSONDetails: nil,
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(recorder, req)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.statusCode)
		got, ok := responder.obj.(*datasourceV0.HealthCheckResult)
		require.True(t, ok)
		require.Equal(t, "ok", got.Message)
		require.Nil(t, got.Details)
	})

	t.Run("OK status with empty JSONDetails does not error", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{
						Status:      backend.HealthStatusOk,
						Message:     "ok",
						JSONDetails: []byte{},
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		handler.ServeHTTP(recorder, req)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.statusCode)
		require.NotNil(t, responder.obj)
	})

	t.Run("all health statuses map to correct HTTP code", func(t *testing.T) {
		statusCases := []struct {
			status       backend.HealthStatus
			wantHTTPCode int
		}{
			{backend.HealthStatusOk, http.StatusOK},
			{backend.HealthStatusError, http.StatusBadRequest},
			{backend.HealthStatusUnknown, http.StatusBadRequest},
		}
		for _, tc := range statusCases {
			t.Run(tc.status.String(), func(t *testing.T) {
				shr := subHealthREST{
					builder: &DataSourceAPIBuilder{
						client: mockHealthClient{
							resp: &backend.CheckHealthResult{
								Status:  tc.status,
								Message: "msg",
							},
						},
						datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
						contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
					},
				}
				responder := &mockHealthResponder{}
				handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
				require.NoError(t, err)

				recorder := httptest.NewRecorder()
				req := httptest.NewRequest(http.MethodGet, "/", nil)
				handler.ServeHTTP(recorder, req)

				require.NoError(t, responder.err)
				require.Equal(t, tc.wantHTTPCode, responder.statusCode)
				got, ok := responder.obj.(*datasourceV0.HealthCheckResult)
				require.True(t, ok)
				require.Equal(t, int(tc.status), got.Code)
				require.Equal(t, tc.status.String(), got.Status)
				require.Equal(t, "msg", got.Message)
			})
		}
	})

	t.Run("CheckHealth receives plugin context from builder", func(t *testing.T) {
		pluginCtx := backend.PluginContext{
			GrafanaConfig: config.NewGrafanaCfg(map[string]string{"k": "v"}),
			DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
				UID:  "test-ds",
				Name: "Test Datasource",
			},
		}
		var capturedRequest *backend.CheckHealthRequest
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					checkHealthFunc: func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
						capturedRequest = req
						return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "ok"}, nil
					},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds", Name: "Test Datasource"}},
				contextProvider: &mockHealthContextProvider{pluginCtx: pluginCtx},
			},
		}

		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "test-ds", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/datasources/test-ds/health", nil)
		handler.ServeHTTP(recorder, req)
		require.NoError(t, responder.err)
		require.NotNil(t, capturedRequest)
		require.NotNil(t, capturedRequest.PluginContext)
		require.Equal(t, pluginCtx.GrafanaConfig, capturedRequest.PluginContext.GrafanaConfig)
		require.Equal(t, "test-ds", capturedRequest.PluginContext.DataSourceInstanceSettings.UID)
		require.Equal(t, "Test Datasource", capturedRequest.PluginContext.DataSourceInstanceSettings.Name)
	})

	t.Run("handler succeeds with full request URL", func(t *testing.T) {
		shr := subHealthREST{
			builder: &DataSourceAPIBuilder{
				client: mockHealthClient{
					resp: &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "ok"},
				},
				datasources:     &mockHealthDatasourceProvider{instanceSettings: &backend.DataSourceInstanceSettings{}},
				contextProvider: &mockHealthContextProvider{pluginCtx: backend.PluginContext{GrafanaConfig: config.NewGrafanaCfg(map[string]string{})}},
			},
		}
		responder := &mockHealthResponder{}
		handler, err := shr.Connect(context.Background(), "dsname", nil, responder)
		require.NoError(t, err)

		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/dsname/health", nil)
		handler.ServeHTTP(recorder, req)

		require.NoError(t, responder.err)
		require.Equal(t, http.StatusOK, responder.statusCode)
	})
}
