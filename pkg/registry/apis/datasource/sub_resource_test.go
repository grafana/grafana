package datasource

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type resourceMockClient struct {
	callResourceFunc func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error
}

func (m *resourceMockClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, nil
}

func (m *resourceMockClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m *resourceMockClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if m.callResourceFunc != nil {
		return m.callResourceFunc(ctx, req, sender)
	}
	return nil
}

func (m *resourceMockClient) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	return nil
}

func (m *resourceMockClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return nil, nil
}

type resourceMockDatasourceProvider struct {
	instanceSettings    *backend.DataSourceInstanceSettings
	instanceSettingsErr error
}

func (m *resourceMockDatasourceProvider) GetDataSource(ctx context.Context, uid string) (*datasourceV0.DataSource, error) {
	return nil, nil
}

func (m *resourceMockDatasourceProvider) ListDataSources(ctx context.Context) (*datasourceV0.DataSourceList, error) {
	return nil, nil
}

func (m *resourceMockDatasourceProvider) CreateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	return nil, nil
}

func (m *resourceMockDatasourceProvider) UpdateDataSource(ctx context.Context, ds *datasourceV0.DataSource) (*datasourceV0.DataSource, error) {
	return nil, nil
}

func (m *resourceMockDatasourceProvider) DeleteDataSource(ctx context.Context, uid string) error {
	return nil
}

func (m *resourceMockDatasourceProvider) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	return m.instanceSettings, m.instanceSettingsErr
}

type resourceMockContextProvider struct {
	pluginCtx    backend.PluginContext
	pluginCtxErr error
}

func (m *resourceMockContextProvider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return m.pluginCtx, m.pluginCtxErr
}

type resourceMockResponder struct {
	lastErr error
}

func (m *resourceMockResponder) Object(statusCode int, obj runtime.Object) {}

func (m *resourceMockResponder) Error(err error) {
	m.lastErr = err
}

func TestResourceRequest(t *testing.T) {
	testCases := []struct {
		desc         string
		url          string
		error        bool
		expectedPath string
		expectedURL  string
	}{
		{
			desc:  "no resource path",
			url:   "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc",
			error: true,
		},
		{
			desc:         "root resource path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource",
			expectedPath: "",
			expectedURL:  "",
		},
		{
			desc:         "root resource path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/",
			expectedPath: "",
			expectedURL:  "",
		},
		{
			desc:         "resource sub path",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test",
			expectedPath: "test",
			expectedURL:  "test",
		},
		{
			desc:         "resource sub path with colon",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test-*,*:test-*/_mapping",
			expectedPath: "test-*,*:test-*/_mapping",
			expectedURL:  "./test-%2A,%2A:test-%2A/_mapping",
		},
		{
			desc:         "resource sub path with query params",
			url:          "http://localhost:6443/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/abc/resource/test?k1=v1&k2=v2",
			expectedPath: "test",
			expectedURL:  "test?k1=v1&k2=v2",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, tc.url, nil)
			clonedReq, err := resourceRequest(req)

			if tc.error {
				require.Error(t, err)
				require.Nil(t, clonedReq)
			} else {
				require.NoError(t, err)
				require.NotNil(t, clonedReq)
				require.Equal(t, tc.expectedPath, clonedReq.URL.Path)
				require.Equal(t, tc.expectedURL, clonedReq.URL.String())
			}
		})
	}
}

func TestSubResourceREST_Connect(t *testing.T) {
	t.Run("returns error when GetInstanceSettings fails", func(t *testing.T) {
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettingsErr: errors.New("datasource not found"),
		}
		mockContext := &resourceMockContextProvider{}

		builder := &DataSourceAPIBuilder{
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		responder := &resourceMockResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.Error(t, err)
		require.Nil(t, handler)
		require.Contains(t, err.Error(), "datasource not found")
	})

	t.Run("returns error when PluginContextForDataSource fails", func(t *testing.T) {
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{
				UID:  "test-ds",
				Name: "Test Datasource",
			},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtxErr: errors.New("failed to create plugin context"),
		}

		builder := &DataSourceAPIBuilder{
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		responder := &resourceMockResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.Error(t, err)
		require.Nil(t, handler)
		require.Contains(t, err.Error(), "failed to create plugin context")
	})

	t.Run("successfully creates handler and forwards request", func(t *testing.T) {
		var capturedRequest *backend.CallResourceRequest

		mockClient := &resourceMockClient{
			callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				capturedRequest = req
				return sender.Send(&backend.CallResourceResponse{
					Status:  http.StatusOK,
					Headers: map[string][]string{"Content-Type": {"application/json"}},
					Body:    []byte(`{"message": "success"}`),
				})
			},
		}
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{
				UID:  "test-ds",
				Name: "Test Datasource",
			},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{
				DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
					UID:  "test-ds",
					Name: "Test Datasource",
				},
			},
		}

		builder := &DataSourceAPIBuilder{
			client:          mockClient,
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		responder := &resourceMockResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)

		require.NoError(t, err)
		require.NotNil(t, handler)

		reqBody := []byte(`{"test": "data"}`)
		req := httptest.NewRequest(http.MethodPost, "http://localhost/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-ds/resource/some/path?key=value", bytes.NewReader(reqBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Custom-Header", "custom-value")

		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		require.NotNil(t, capturedRequest)
		require.Equal(t, http.MethodPost, capturedRequest.Method)
		require.Equal(t, "some/path", capturedRequest.Path)
		require.Equal(t, "some/path?key=value", capturedRequest.URL)
		require.Equal(t, reqBody, capturedRequest.Body)
		require.Contains(t, capturedRequest.Headers["Content-Type"], "application/json")
		require.Contains(t, capturedRequest.Headers["X-Custom-Header"], "custom-value")

		require.Equal(t, http.StatusOK, recorder.Code)
		require.Equal(t, `{"message": "success"}`, recorder.Body.String())
	})

	t.Run("forwards all HTTP methods correctly", func(t *testing.T) {
		methods := []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodHead,
			http.MethodOptions,
		}

		for _, method := range methods {
			t.Run(method, func(t *testing.T) {
				var capturedMethod string

				mockClient := &resourceMockClient{
					callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
						capturedMethod = req.Method
						return sender.Send(&backend.CallResourceResponse{
							Status: http.StatusOK,
							Body:   []byte("ok"),
						})
					},
				}
				mockProvider := &resourceMockDatasourceProvider{
					instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds"},
				}
				mockContext := &resourceMockContextProvider{
					pluginCtx: backend.PluginContext{},
				}

				builder := &DataSourceAPIBuilder{
					client:          mockClient,
					datasources:     mockProvider,
					contextProvider: mockContext,
				}
				r := &subResourceREST{builder: builder}

				handler, err := r.Connect(context.Background(), "test-ds", nil, &resourceMockResponder{})
				require.NoError(t, err)

				req := httptest.NewRequest(method, "http://localhost/apis/test/resource/path", nil)
				recorder := httptest.NewRecorder()
				handler.ServeHTTP(recorder, req)

				require.Equal(t, method, capturedMethod)
			})
		}
	})

	t.Run("handles CallResource error", func(t *testing.T) {
		mockClient := &resourceMockClient{
			callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				return errors.New("plugin error")
			},
		}
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds"},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		}

		builder := &DataSourceAPIBuilder{
			client:          mockClient,
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		responder := &resourceMockResponder{}
		handler, err := r.Connect(context.Background(), "test-ds", nil, responder)
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resource/path", nil)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		// The responder should have received the error
		require.NotNil(t, responder.lastErr)
		require.Contains(t, responder.lastErr.Error(), "plugin error")
	})

	t.Run("forwards request body to plugin", func(t *testing.T) {
		var capturedBody []byte

		mockClient := &resourceMockClient{
			callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				capturedBody = req.Body
				return sender.Send(&backend.CallResourceResponse{
					Status: http.StatusOK,
				})
			},
		}
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds"},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		}

		builder := &DataSourceAPIBuilder{
			client:          mockClient,
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		handler, err := r.Connect(context.Background(), "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)

		requestBody := `{"key": "value", "nested": {"foo": "bar"}}`
		req := httptest.NewRequest(http.MethodPost, "http://localhost/apis/test/resource/path", bytes.NewBufferString(requestBody))

		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		require.Equal(t, requestBody, string(capturedBody))
	})

	t.Run("handles empty request body", func(t *testing.T) {
		var capturedBody []byte

		mockClient := &resourceMockClient{
			callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				capturedBody = req.Body
				return sender.Send(&backend.CallResourceResponse{
					Status: http.StatusOK,
				})
			},
		}
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds"},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		}

		builder := &DataSourceAPIBuilder{
			client:          mockClient,
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		handler, err := r.Connect(context.Background(), "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resource/path", nil)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		require.Empty(t, capturedBody)
	})

	t.Run("preserves query parameters in URL", func(t *testing.T) {
		var capturedURL string
		var capturedPath string

		mockClient := &resourceMockClient{
			callResourceFunc: func(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
				capturedURL = req.URL
				capturedPath = req.Path
				return sender.Send(&backend.CallResourceResponse{
					Status: http.StatusOK,
				})
			},
		}
		mockProvider := &resourceMockDatasourceProvider{
			instanceSettings: &backend.DataSourceInstanceSettings{UID: "test-ds"},
		}
		mockContext := &resourceMockContextProvider{
			pluginCtx: backend.PluginContext{},
		}

		builder := &DataSourceAPIBuilder{
			client:          mockClient,
			datasources:     mockProvider,
			contextProvider: mockContext,
		}
		r := &subResourceREST{builder: builder}

		handler, err := r.Connect(context.Background(), "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)

		req := httptest.NewRequest(http.MethodGet, "http://localhost/apis/test/resource/api/endpoint?foo=bar&baz=qux", nil)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, req)

		require.Equal(t, "api/endpoint", capturedPath)
		require.Equal(t, "api/endpoint?foo=bar&baz=qux", capturedURL)
	})
}
