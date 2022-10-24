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

func MetricsHandler(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, parameters url.Values) ([]byte, *models.HttpError) {
	metricsRequest, err := request.GetMetricsRequest(parameters)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusBadRequest, err)
	}

	service, err := newListMetricsService(pluginCtx, clientFactory, metricsRequest.Region)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	var metrics []*models.Metric
	switch metricsRequest.Type() {
	case request.AllMetricsRequestType:
		metrics = services.GetAllHardCodedMetrics()
	case request.MetricsByNamespaceRequestType:
		metrics, err = services.GetHardCodedMetricsByNamespace(metricsRequest.Namespace)
	case request.CustomNamespaceRequestType:
		metrics, err = service.GetMetricsByNamespace(metricsRequest.Namespace)
	}
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	metricsResponse, err := json.Marshal(metrics)
	if err != nil {
		return nil, models.NewHttpError("error in MetricsHandler", http.StatusInternalServerError, err)
	}

	return metricsResponse, nil
}
