package config

import (
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/grafana-app-sdk/simple"
)

type NotificationConfig struct {
	Enabled bool
	Loki    lokiclient.LokiConfig
}

type RuntimeConfig struct {
	GetAlertStateHistoryHandler simple.AppCustomRouteHandler
	Notification                NotificationConfig
}
