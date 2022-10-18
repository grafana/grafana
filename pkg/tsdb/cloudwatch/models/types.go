package models

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type Clients struct {
	MetricsClientProvider MetricsClientProvider
}

type ClientsFactoryFunc func(pluginCtx backend.PluginContext, region string) (clients Clients, err error)

type ClientsFactoryInterface interface {
	GetClients(pluginCtx backend.PluginContext, region string) (clients Clients, err error)
}
