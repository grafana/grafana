package models

import (
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Clients struct {
	MetricsClientProvider MetricsClientProvider
}

type ClientsFactoryFunc func(pluginCtx backend.PluginContext, region string) (clients Clients, err error)

type ClientsFactoryInterface interface {
	GetClients(pluginCtx backend.PluginContext, region string) (clients Clients, err error)
}

type RouteHandlerFunc func(http.ResponseWriter, *http.Request, ClientsFactoryFunc, backend.PluginContext)
