package models

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type ClientsProvider interface {
	MetricsClientProvider
}

type ClientsFactoryFunc func(pluginCtx backend.PluginContext, region string) (clients ClientsProvider, err error)

type RouteHandlerFunc func(http.ResponseWriter, *http.Request, ClientsFactoryFunc, backend.PluginContext)
