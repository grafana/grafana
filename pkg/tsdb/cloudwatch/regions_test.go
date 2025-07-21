package cloudwatch

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestRegionsRoute(t *testing.T) {
	origNewRegionsService := services.NewRegionsService
	t.Cleanup(func() {
		services.NewRegionsService = origNewRegionsService
	})
	var mockRegionService mocks.RegionsService
	services.NewRegionsService = func(models.EC2APIProvider, log.Logger) models.RegionsAPIProvider {
		return &mockRegionService
	}

	t.Run("returns 200 and regions", func(t *testing.T) {
		mockRegionService = mocks.RegionsService{}
		mockRegionService.On("GetRegions", mock.Anything).Return([]resources.ResourceResponse[resources.Region]{{
			Value: resources.Region{
				Name: "us-east-1",
			},
		}}, nil).Once()

		rr := httptest.NewRecorder()
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-1"
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.RegionsHandler))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), "us-east-1")
	})

	t.Run("returns 400 when the service returns a missing region error", func(t *testing.T) {
		rr := httptest.NewRecorder()
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = ""
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.RegionsHandler))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Contains(t, rr.Body.String(), "Error in Regions Handler when connecting to aws without a default region selection: missing default region")
	})

	t.Run("returns 500 when get regions returns an error", func(t *testing.T) {
		mockRegionService = mocks.RegionsService{}
		mockRegionService.On("GetRegions", mock.Anything).Return([]resources.ResourceResponse[resources.Region](nil), errors.New("aws is having some kind of outage")).Once()
		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", `/regions`, nil)
		ds := newTestDatasource(func(ds *DataSource) {
			ds.Settings.Region = "us-east-1"
		})
		handler := http.HandlerFunc(ds.resourceRequestMiddleware(ds.RegionsHandler))
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Contains(t, rr.Body.String(), "Error in Regions Handler while fetching regions: aws is having some kind of outage")
	})
}
