package routes

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/resource/httpadapter"
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
)

func RouteInjector(handleFunc models.RouteHandlerFunc, clientFactory models.ClientsFactoryFunc) func(rw http.ResponseWriter, req *http.Request) {
	return func(rw http.ResponseWriter, req *http.Request) {
		ctx := req.Context()
		pluginContext := httpadapter.PluginConfigFromContext(ctx)
		handleFunc(rw, req, clientFactory, pluginContext)
	}
}
