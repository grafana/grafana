package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func TestSubQueryConnectWhenDatasourceNotFound(t *testing.T) {
	sqr := subQueryREST{
		builder: &DataSourceAPIBuilder{
			client: mockClient{
				lastCalledWithHeaders: &map[string]string{},
			},
			datasources:     mockDatasources{},
			contextProvider: mockContextProvider{},
		},
	}

	mr := mockResponder{}
	_, err := sqr.Connect(context.Background(), "dsname-that-does-not-exist", nil, mr)
	require.Error(t, err)
	var statusErr *k8serrors.StatusError
	require.True(t, errors.As(err, &statusErr))
	require.Equal(t, int32(404), statusErr.Status().Code)
}

type mockClient struct {
	lastCalledWithHeaders *map[string]string
}

func (m mockClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	*m.lastCalledWithHeaders = req.Headers
	return nil, fmt.Errorf("mock error")
}

func (m mockClient) QueryChunkedData(ctx context.Context, req *backend.QueryChunkedDataRequest, w backend.ChunkedDataWriter) error {
	*m.lastCalledWithHeaders = req.Headers
	return fmt.Errorf("mock error")
}

func (m mockClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return nil
}

func (m mockClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (m mockClient) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	return nil, nil
}

type mockResponder struct {
}

// Object writes the provided object to the response. Invoking this method multiple times is undefined.
func (m mockResponder) Object(statusCode int, obj runtime.Object) {
}

// Error writes the provided error to the response. This method may only be invoked once.
func (m mockResponder) Error(err error) {
}

var _ PluginDatasourceProvider = (*mockDatasources)(nil)

type mockDatasources struct {
}

// CreateDataSource implements PluginDatasourceProvider.
func (m mockDatasources) CreateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// UpdateDataSource implements PluginDatasourceProvider.
func (m mockDatasources) UpdateDataSource(ctx context.Context, ds *v0alpha1.DataSource) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// Delete implements PluginDatasourceProvider.
func (m mockDatasources) DeleteDataSource(ctx context.Context, uid string) error {
	return nil
}

// GetDataSource implements PluginDatasourceProvider.
func (m mockDatasources) GetDataSource(ctx context.Context, uid string) (*v0alpha1.DataSource, error) {
	return nil, nil
}

// ListDataSource implements PluginDatasourceProvider.
func (m mockDatasources) ListDataSources(ctx context.Context) (*v0alpha1.DataSourceList, error) {
	return nil, nil
}

// Get gets a specific datasource (that the user in context can see)
func (m mockDatasources) GetConnection(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	return nil, nil
}

// List lists all data sources the user in context can see
func (m mockDatasources) ListConnections(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	return nil, nil
}

// Return settings (decrypted!) for a specific plugin
// This will require "query" permission for the user in context
func (m mockDatasources) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	if uid == "dsname" {
		return nil, nil
	}
	return nil, datasources.ErrDataSourceNotFound
}

type mockContextProvider struct {
}

func (m mockContextProvider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}

func TestSubQueryResponseFormats(t *testing.T) {
	for _, accept := range []string{"application/json", v0alpha1.PROTOBUF_CONTENT_TYPE} {
		t.Run(accept, func(t *testing.T) {
			for _, tc := range []struct {
				name   string
				err    error
				status int
			}{
				{name: "success", status: http.StatusOK},
				{name: "downstream error", err: errutil.Error{LogMessage: "downstream failed", Source: errutil.SourceDownstream}, status: http.StatusBadRequest},
				{name: "plugin error", err: errors.New("plugin failed")},
			} {
				t.Run(tc.name, func(t *testing.T) {
					response := &backend.QueryDataResponse{Responses: backend.Responses{
						"A": {Frames: data.Frames{data.NewFrame("result", data.NewField("value", nil, []float64{42}))}},
					}}
					r := subQueryREST{builder: &DataSourceAPIBuilder{
						client:          queryResponseClient{response: response, err: tc.err},
						datasources:     mockDatasources{},
						contextProvider: mockContextProvider{},
					}}
					responder := &mockHealthResponder{}
					handler, err := r.Connect(context.Background(), "dsname", nil, responder)
					require.NoError(t, err)
					req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(`{"queries":[]}`))
					req.Header.Set("Content-Type", "application/json")
					req.Header.Set("Accept", accept)
					w := httptest.NewRecorder()
					handler.ServeHTTP(w, req)

					if tc.status == 0 {
						require.ErrorIs(t, responder.err, tc.err)
						require.Nil(t, responder.obj)
						require.Empty(t, w.Body.Bytes())
						return
					}
					require.NoError(t, responder.err)
					var result *backend.QueryDataResponse
					if accept == v0alpha1.PROTOBUF_CONTENT_TYPE {
						require.Equal(t, tc.status, w.Code)
						require.Equal(t, accept, w.Header().Get("Content-Type"))
						require.Nil(t, responder.obj)
						var wire pluginv2.QueryDataResponse
						require.NoError(t, proto.Unmarshal(w.Body.Bytes(), &wire))
						result, err = backend.FromProto().QueryDataResponse(&wire)
						require.NoError(t, err)
					} else {
						require.Equal(t, tc.status, responder.statusCode)
						require.IsType(t, &v0alpha1.QueryDataResponse{}, responder.obj)
						result = &responder.obj.(*v0alpha1.QueryDataResponse).QueryDataResponse
					}
					require.Contains(t, result.Responses, "A")
					if tc.err != nil {
						require.EqualError(t, result.Responses["A"].Error, "downstream failed")
						require.Equal(t, backend.ErrorSourceDownstream, result.Responses["A"].ErrorSource)
					} else {
						require.Len(t, result.Responses["A"].Frames, 1)
						require.Len(t, result.Responses["A"].Frames[0].Fields, 1)
						require.Equal(t, float64(42), result.Responses["A"].Frames[0].Fields[0].At(0))
					}
				})
			}
		})
	}
}

type queryResponseClient struct {
	mockClient
	response *backend.QueryDataResponse
	err      error
}

func (m queryResponseClient) QueryData(context.Context, *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return m.response, m.err
}
