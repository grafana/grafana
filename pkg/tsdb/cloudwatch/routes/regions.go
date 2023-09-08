package routes

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

const (
	defaultRegion = "default"
)

func RegionsHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	service, err := newRegionsService(ctx, pluginCtx, reqCtxFactory, defaultRegion)
	if err != nil {
		if errors.Is(err, &models.MissingRegion{}) {
			return nil, models.NewHttpError("Error in Regions Handler when connecting to aws without a default region selection", http.StatusBadRequest, err)
		}
		return nil, models.NewHttpError("Error in Regions Handler when connecting to aws", http.StatusInternalServerError, err)
	}

	regions, err := service.GetRegions()
	if err != nil {
		return nil, models.NewHttpError("Error in Regions Handler while fetching regions", http.StatusInternalServerError, err)
	}

	regionsResponse, err := json.Marshal(regions)
	if err != nil {
		return nil, models.NewHttpError("Error in Regions Handler while parsing regions", http.StatusInternalServerError, err)
	}

	return regionsResponse, nil
}

var newRegionsService = func(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.RegionsAPIProvider, error) {
	reqCtx, err := reqCtxFactory(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewRegionsService(reqCtx.EC2APIProvider), nil
}
