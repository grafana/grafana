package routes

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/request"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func DimensionKeysHandler(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionKeysRequest, err := request.GetDimensionKeysRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(pluginCtx, reqCtxFactory, dimensionKeysRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	dimensionKeys := []string{}
	switch dimensionKeysRequest.Type() {
	case request.StandardDimensionKeysRequest:
		dimensionKeys, err = services.GetHardCodedDimensionKeysByNamespace(dimensionKeysRequest.Namespace)
	case request.FilterDimensionKeysRequest:
		dimensionKeys, err = service.GetDimensionKeysByDimensionFilter(dimensionKeysRequest)
	case request.CustomMetricDimensionKeysRequest:
		dimensionKeys, err = service.GetDimensionKeysByNamespace(dimensionKeysRequest.Namespace)
	}
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	dimensionKeysResponse, err := json.Marshal(dimensionKeys)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	return dimensionKeysResponse, nil
}

// newListMetricsService is an list metrics service factory.
//
// Stubbable by tests.
var newListMetricsService = func(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.ListMetricsProvider, error) {
	metricClient, err := reqCtxFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewListMetricsService(metricClient.MetricsClientProvider), nil
}
