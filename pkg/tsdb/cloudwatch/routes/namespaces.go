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

	hardcodedNamespaces := services.GetHardCodedNamespaces()
	customNamespaces := reqCtx.Settings.Namespace
	if customNamespaces != "" {
		hardcodedNamespaces = append(hardcodedNamespaces, strings.Split(customNamespaces, ",")...)
	}
	sort.Strings(hardcodedNamespaces)

	namespacesResponse, err := json.Marshal(hardcodedNamespaces)
	if err != nil {
		return nil, models.NewHttpError("error in NamespacesHandler", http.StatusInternalServerError, err)
	}

	return namespacesResponse, nil
}
