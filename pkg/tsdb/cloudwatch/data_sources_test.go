package cloudwatch

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/utils"
)

func TestDataSourcesRoute(t *testing.T) {
	origDataSourcesService := services.NewDataSourcesService
	t.Cleanup(func() {
		services.NewDataSourcesService = origDataSourcesService
	})

	var mockDataSourcesService = mocks.DataSourcesService{}
	services.NewDataSourcesService = func(models.CloudWatchLogsAPIProvider, bool) models.DataSourcesProvider {
		return &mockDataSourcesService
	}

	t.Run("successfully returns data sources", func(t *testing.T) {
		mockDataSourcesService = mocks.DataSourcesService{}
		mockDataSourcesService.On("GetDataSources", mock.Anything).Return([]resources.ResourceResponse[resources.LogDataSource]{{
			Value: resources.LogDataSource{
				Name: "amazon_vpc",
				Type: "flow",
			},
		}}, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/data-sources", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DataSourcesHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.JSONEq(t, `[{"value":{"name":"amazon_vpc","type":"flow"}}]`, rr.Body.String())
	})

	t.Run("passes pattern from query parameter", func(t *testing.T) {
		mockDataSourcesService = mocks.DataSourcesService{}
		mockDataSourcesService.On("GetDataSources", mock.Anything).Return([]resources.ResourceResponse[resources.LogDataSource]{}, nil)

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/data-sources?pattern=amazon", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DataSourcesHandler))
		handler.ServeHTTP(rr, req)

		mockDataSourcesService.AssertCalled(t, "GetDataSources", resources.DataSourcesRequest{
			Pattern: utils.Pointer("amazon"),
		})
	})

	t.Run("returns error if service returns error", func(t *testing.T) {
		mockDataSourcesService = mocks.DataSourcesService{}
		mockDataSourcesService.On("GetDataSources", mock.Anything).
			Return([]resources.ResourceResponse[resources.LogDataSource]{}, fmt.Errorf("some error"))

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/data-sources", nil)
		ds := newTestDatasource()
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.DataSourcesHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.JSONEq(t, `{"Error":"some error","Message":"GetDataSources error: some error","StatusCode":500}`, rr.Body.String())
	})
}
