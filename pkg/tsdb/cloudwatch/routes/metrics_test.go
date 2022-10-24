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

func Test_Metrics_Route(t *testing.T) {
	t.Run("calls GetMetricsByNamespace when a CustomNamespaceRequestType is passed", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetMetricsByNamespace").Return([]models.Metric{}, nil)
		newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/metrics?region=us-east-2&namespace=customNamespace", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(MetricsHandler, nil))
		handler.ServeHTTP(rr, req)
		mockListMetricsService.AssertNumberOfCalls(t, "GetMetricsByNamespace", 1)
	})

	t.Run("returns 500 if GetMetricsByNamespace returns an error", func(t *testing.T) {
		mockListMetricsService := mocks.ListMetricsServiceMock{}
		mockListMetricsService.On("GetMetricsByNamespace").Return([]models.Metric{}, fmt.Errorf("some error"))
		newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
			return &mockListMetricsService, nil
		}
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/metrics?region=us-east-2&namespace=customNamespace", nil)
		handler := http.HandlerFunc(ResourceRequestMiddleware(MetricsHandler, nil))
		handler.ServeHTTP(rr, req)
		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Equal(t, `{"Message":"error in MetricsHandler: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
	})
}
