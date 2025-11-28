package config

import (
	"github.com/grafana/grafana-app-sdk/simple"
)

type RuntimeConfig struct {
	GetAlertStateHistoryHandler simple.AppCustomRouteHandler
}
