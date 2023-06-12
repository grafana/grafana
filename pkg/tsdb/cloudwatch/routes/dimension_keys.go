package routes

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func DimensionKeysHandler(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	dimensionKeysRequest, err := resources.GetDimensionKeysRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(ctx, pluginCtx, reqCtxFactory, dimensionKeysRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	var response []resources.ResourceResponse[string]
	switch dimensionKeysRequest.Type() {
	case resources.FilterDimensionKeysRequest:
		response, err = service.GetDimensionKeysByDimensionFilter(dimensionKeysRequest)
	default:
		response, err = services.GetHardCodedDimensionKeysByNamespace(dimensionKeysRequest.Namespace)
	}
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	jsonResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in DimensionKeyHandler", http.StatusInternalServerError, err)
	}

	return jsonResponse, nil
}

// newListMetricsService is an list metrics service factory.
//
// Stubbable by tests.
var newListMetricsService = func(ctx context.Context, pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, region string) (models.ListMetricsProvider, error) {
	metricClient, err := reqCtxFactory(ctx, pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewListMetricsService(metricClient.MetricsClientProvider), nil
}
