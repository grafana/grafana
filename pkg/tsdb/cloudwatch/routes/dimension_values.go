package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
)

func DimensionValuesHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionValuesRequest, err := resources.GetDimensionValuesRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(ctx, pluginCtx, reqCtxFactory, dimensionValuesRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	response, err := service.GetDimensionValuesByDimensionFilter(dimensionValuesRequest)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	dimensionValuesResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	return dimensionValuesResponse, nil
}
