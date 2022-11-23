package routes

import (
	"encoding/json"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/services"
)

func NamespacesHandler(pluginCtx backend.PluginContext, reqCtxFactory models.RequestContextFactoryFunc, _ url.Values) ([]byte, *models.HttpError) {
	reqCtx, err := reqCtxFactory(pluginCtx, "default")
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	result := services.GetHardCodedNamespaces()
	customNamespace := reqCtx.Settings.Namespace
	if customNamespace != "" {
		result = append(result, strings.Split(customNamespace, ",")...)
	}
	sort.Strings(result)

	namespacesResponse, err := json.Marshal(result)
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	return namespacesResponse, nil
}
