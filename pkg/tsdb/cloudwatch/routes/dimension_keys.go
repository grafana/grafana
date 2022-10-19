package routes

import (
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func DimensionKeysHandler(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionKeysQuery, err := models.GetDimensionKeysQuery(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(pluginCtx, clientFactory, dimensionKeysQuery.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	dimensionKeys := []string{}
	switch dimensionKeysQuery.Type() {
	case models.StandardDimensionKeysQuery:
		dimensionKeys, err = service.GetHardCodedDimensionKeysByNamespace(dimensionKeysQuery.Namespace)
	case models.FilterDimensionKeysQuery:
		dimensionKeys, err = service.GetDimensionKeysByDimensionFilter(dimensionKeysQuery)
	case models.CustomMetricDimensionKeysQuery:
		dimensionKeys, err = service.GetDimensionKeysByNamespace(dimensionKeysQuery.Namespace)
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
var newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
	metricClient, err := clientFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewListMetricsService(metricClient.MetricsClientProvider), nil
}
