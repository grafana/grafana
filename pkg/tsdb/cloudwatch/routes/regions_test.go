package routes

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/mocks"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

func TestRegionsRoute(t *testing.T) {
	origNewRegionsService := newRegionsService
	t.Cleanup(func() {
		newRegionsService = origNewRegionsService
	})

	t.Run("returns 200 and regions", func(t *testing.T) {
		mockRegionService := mocks.RegionsService{}
		newRegionsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.RegionsAPIProvider, error) {
			return &mockRegionService, nil
		}
		mockRegionService.On("GetRegions", mock.Anything).Return([]resources.ResourceResponse[resources.Region]{{
			Value: resources.Region{
				Name: "us-east-1",
			},
		}}, nil).Once()

		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(ResourceRequestMiddleware(RegionsHandler, logger, nil))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusOK, rr.Code)
		assert.Contains(t, rr.Body.String(), "us-east-1")
	})

	t.Run("returns 400 when the service returns a missing region error", func(t *testing.T) {
		newRegionsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.RegionsAPIProvider, error) {
			return nil, models.ErrMissingRegion
		}
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(ResourceRequestMiddleware(RegionsHandler, logger, nil))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusBadRequest, rr.Code)
		assert.Contains(t, rr.Body.String(), "Error in Regions Handler when connecting to aws without a default region selection: missing default region")
	})

	t.Run("returns 500 when the service returns an unexpected error", func(t *testing.T) {
		newRegionsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.RegionsAPIProvider, error) {
			return nil, errors.New("something unexpected happened")
		}
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(ResourceRequestMiddleware(RegionsHandler, logger, nil))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Contains(t, rr.Body.String(), "Error in Regions Handler when connecting to aws: something unexpected happened")
	})

	t.Run("returns 500 when get regions returns an error", func(t *testing.T) {
		mockRegionService := mocks.RegionsService{}
		newRegionsService = func(_ context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.RegionsAPIProvider, error) {
			return &mockRegionService, nil
		}
		mockRegionService.On("GetRegions", mock.Anything).Return([]resources.ResourceResponse[resources.Region](nil), errors.New("aws is having some kind of outage")).Once()
		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(ResourceRequestMiddleware(RegionsHandler, logger, nil))
		req := httptest.NewRequest("GET", `/regions`, nil)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusInternalServerError, rr.Code)
		assert.Contains(t, rr.Body.String(), "Error in Regions Handler while fetching regions: aws is having some kind of outage")
	})
}
