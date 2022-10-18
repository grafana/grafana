package routes

import (
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

type DimensionKeyHandler struct {
	ClientFactory models.ClientsFactoryFunc
}

func (h *DimensionKeyHandler) ServeHTTP(rw http.ResponseWriter, req *http.Request) {
	pluginCtx := httpadapter.PluginConfigFromContext(req.Context())

	if req.Method != "GET" {
		respondWithError(rw, http.StatusMethodNotAllowed, "Invalid method", nil)
		return
	}
	dimensionKeysQuery, err := models.GetDimensionKeysQuery(req.URL.Query())
	if err != nil {
		respondWithError(rw, http.StatusBadRequest, err.Error(), err)
		return
	}

	service, err := newListMetricsService(pluginCtx, h.ClientFactory, dimensionKeysQuery.Region)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error in DimensionKeysHandler", err)
		return
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
		respondWithError(rw, http.StatusInternalServerError, "error in DimensionKeyHandler", err)
		return
	}

	dimensionKeysResponse, err := json.Marshal(dimensionKeys)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error in DimensionKeyHandler", err)
		return
	}

	rw.Header().Set("Content-Type", "application/json")
	_, err = rw.Write(dimensionKeysResponse)
	if err != nil {
		respondWithError(rw, http.StatusInternalServerError, "error writing response in DimensionKeyHandler", err)
	}
}

// newListMetricsService is an list metrics service factory.
//
// Stubbable by tests.
var newListMetricsService = func(pluginCtx backend.PluginContext, clientFactory models.ClientsFactoryFunc, region string) (models.ListMetricsProvider, error) {
	clients, err := clientFactory(pluginCtx, region)
	if err != nil {
		return nil, err
	}

	return services.NewListMetricsService(clients.MetricsClientProvider), nil
}
