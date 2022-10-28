package routes

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func Test_DimensionValues_Route(t *testing.T) {
	t.Run("Calls GetDimensionValuesByDimensionFilter when a valid request is passed", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionValuesByDimensionFilter", mock.Anything).Return([]models.ResourceResponse[string]{}, nil).Once()
		newListMetricsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-values?region=us-east-2&dimensionKey=instanceId&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionValuesHandler, logger, nil))
		handler.ServeHTTP(rr, req)
		mockListMetricsService.AssertCalled(t, "GetDimensionValuesByDimensionFilter", resources.DimensionValuesRequest{
			ResourceRequest: &resources.ResourceRequest{Region: "us-east-2"},
			Namespace:       "AWS/EC2",
			MetricName:      "CPUUtilization",
			DimensionKey:    "instanceId",
			DimensionFilter: []*resources.Dimension{{Name: "NodeID", Value: "Shared"}, {Name: "stage", Value: "QueryCommit"}},
		})
	})

	t.Run("returns 500 if GetDimensionValuesByDimensionFilter returns an error", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetDimensionValuesByDimensionFilter", mock.Anything).Return([]models.ResourceResponse[string]{}, fmt.Errorf("some error"))
		newListMetricsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/dimension-values?region=us-east-2&dimensionKey=instanceId&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`, nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionValuesHandler, logger, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error in DimensionValuesHandler: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}
