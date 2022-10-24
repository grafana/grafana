package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/assert"
)

func Test_DimensionKeys_Route(t *testing.T) {
	t.Run("calls FilterDimensionKeysRequest when a StandardDimensionKeysRequest is passed", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionKeysByDimensionFilter").Return([]string{}, nil)
		newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionKeysHandler, nil))
		handler.ServeHTTP(rr, req)
		mockListMetricsService.AssertNumberOfCalls(t, "GetDimensionKeysByDimensionFilter", 1)
	})

	t.Run("return 500 if GetDimensionKeysByDimensionFilter returns an error", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionKeysByDimensionFilter").Return([]string{}, fmt.Errorf("some error"))
		newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionKeysHandler, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error in DimensionKeyHandler: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}
