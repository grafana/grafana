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
	tests := []struct {
		url         string
		methodName  string
		requestType string
	}{
		{
			url:         "/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization",
			methodName:  "GetHardCodedDimensionKeysByNamespace",
			requestType: "StandardDimensionKeysRequest"},
		{
			url:         `/dimension-keys?region=us-east-2&namespace=AWS/EC2&metricName=CPUUtilization&dimensionFilters={"NodeID":["Shared"],"stage":["QueryCommit"]}`,
			methodName:  "GetDimensionKeysByDimensionFilter",
			requestType: "FilterDimensionKeysRequest"},
		{
			url:         `/dimension-keys?region=us-east-2&namespace=customNamespace&metricName=CPUUtilization`,
			methodName:  "GetDimensionKeysByNamespace",
			requestType: "CustomMetricDimensionKeysRequest"},
	}

	for _, tc := range tests {
		t.Run(fmt.Sprintf("calls %s when a StandardDimensionKeysRequest is passed", tc.requestType), func(t *testing.T) {
			mockListMetricsService := mocks.ListMetricsServiceMock{}
			mockListMetricsService.On(tc.methodName).Return([]string{}, nil)
			newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
				return &mockListMetricsService, nil
			}
			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", tc.url, nil)
			handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionKeysHandler, nil))
			handler.ServeHTTP(rr, req)
			mockListMetricsService.AssertNumberOfCalls(t, tc.methodName, 1)
		})
	}

	for _, tc := range tests {
		t.Run(fmt.Sprintf("return 500 if %s returns an error", tc.requestType), func(t *testing.T) {
			mockListMetricsService := mocks.ListMetricsServiceMock{}
			mockListMetricsService.On(tc.methodName).Return([]string{}, fmt.Errorf("some error"))
			newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
				return &mockListMetricsService, nil
			}
			rr := httptest.NewRecorder()
			req := httptest.NewRequest("GET", tc.url, nil)
			handler := http.HandlerFunc(ResourceRequestMiddleware(DimensionKeysHandler, nil))
			handler.ServeHTTP(rr, req)
			assert.Equal(t, http.StatusInternalServerError, rr.Code)
			assert.Equal(t, `{"Message":"error in DimensionKeyHandler: some error","Error":"some error","StatusCode":500}`, rr.Body.String())
		})
	}
}
