package datasource

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
)

func TestSubQueryConnect(t *testing.T) {
	sqr := subQueryREST{
		builder: &DataSourceAPIBuilder{
			client: mockClient{
				lastCalledWithHeaders: &map[string]string{},
			},
			datasources:     mockDatasources{},
			contextProvider: mockContextProvider{},
			log:             log.NewNopLogger(),
		},
	}

	mr := mockResponder{}
	handler, err := sqr.Connect(context.Background(), "dsname", nil, mr)
	require.NoError(t, err)

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/some-path", nil)
	req.Header.Set(models.FromAlertHeaderName, "true")
	req.Header.Set(models.CacheSkipHeaderName, "true")
	req.Header.Set("X-Rule-Uid", "abc")
	req.Header.Set("X-Rule-Folder", "folder-1")
	req.Header.Set("X-Rule-Source", "grafana-ruler")
	req.Header.Set("X-Grafana-Org-Id", "1")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("some-unexpected-header", "some-value")
	handler.ServeHTTP(rr, req)

	// test that headers are forwarded and cased appropriately
	require.Equal(t, map[string]string{
		models.FromAlertHeaderName: "true",
		models.CacheSkipHeaderName: "true",
		"X-Rule-Uid":               "abc",
		"X-Rule-Folder":            "folder-1",
		"X-Rule-Source":            "grafana-ruler",
		"X-Grafana-Org-Id":         "1",
	}, *sqr.builder.client.(mockClient).lastCalledWithHeaders)
}

type mockClient struct {
	lastCalledWithHeaders *map[string]string
}

func (m mockClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	*m.lastCalledWithHeaders = req.Headers
	return nil, fmt.Errorf("mock error")
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

type mockDatasources struct {
}

// Get gets a specific datasource (that the user in context can see)
func (m mockDatasources) Get(ctx context.Context, uid string) (*v0alpha1.DataSourceConnection, error) {
	return nil, nil
}

// List lists all data sources the user in context can see
func (m mockDatasources) List(ctx context.Context) (*v0alpha1.DataSourceConnectionList, error) {
	return nil, nil
}

// Return settings (decrypted!) for a specific plugin
// This will require "query" permission for the user in context
func (m mockDatasources) GetInstanceSettings(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error) {
	return nil, nil
}

type mockContextProvider struct {
}

func (m mockContextProvider) PluginContextForDataSource(ctx context.Context, datasourceSettings *backend.DataSourceInstanceSettings) (backend.PluginContext, error) {
	return backend.PluginContext{}, nil
}
