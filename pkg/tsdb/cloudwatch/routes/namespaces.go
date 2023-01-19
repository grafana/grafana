package routes

import (
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func NamespacesHandler(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, _ url.Values) ([]byte, *models.HttpError) {
	reqCtx, err := reqCtxFactory(pluginCtx, "default")
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	response := services.GetHardCodedNamespaces()
	customNamespace := reqCtx.Settings.Namespace
	if customNamespace != "" {
		customNamespaces := strings.Split(customNamespace, ",")
		for _, customNamespace := range customNamespaces {
			response = append(response, resources.ResourceResponse[string]{Value: customNamespace})
		}
	}
	sort.Slice(response, func(i, j int) bool {
		return response[i].Value < response[j].Value
	})

	namespacesResponse, err := json.Marshal(response)
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	return namespacesResponse, nil
}
