package routes

import (
	"context"
	"encoding/json"
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
		return nil, models.NewHttpError("Unexpected error connecting to aws to fetch regions", http.StatusInternalServerError, err)
	}

	regions, err := service.GetRegions()
	if err != nil {
		return nil, models.NewHttpError("Unexpected error while fetching regions", http.StatusInternalServerError, err)
	}

	regionsResponse, err := json.Marshal(regions)
	if err != nil {
		return nil, models.NewHttpError("Unexpected error parsing regions", http.StatusInternalServerError, err)
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
