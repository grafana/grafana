package routes

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/request"
)

func DimensionValuesHandler(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionValuesRequest, err := request.GetDimensionValuesRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(pluginCtx, clientFactory, dimensionValuesRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	dimensionValues, err := service.GetDimensionValuesByDimensionFilter(dimensionValuesRequest)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	dimensionValuesResponse, err := json.Marshal(dimensionValues)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionValuesHandler", http.StatusInternalServerError, err)
	}

	return dimensionValuesResponse, nil
}
