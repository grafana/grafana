package datasource

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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
