package api

import (
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/prometheus/alertmanager/config"
)

// swagger:route POST /api/v1/alerts AlertingConfig RoutePostAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route GET /api/v1/alerts AlertingConfig RouteGetAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: AlertingConfigResponse
//       400: ValidationError

// swagger:route DELETE /api/v1/alerts AlertingConfig RouteDeleteAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:parameters RoutePostAlertingConfig
type BodyAlertingConfig struct {
	// in:body
	Body AlertingConfig
}

// swagger:model
type AlertingConfigResponse struct {
	BodyAlertingConfig
}

// swagger:model
type AlertingConfig struct {
	config.Config

	// Override with our superset receiver type
	Receivers []*Receiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type GrafanaReceiver alerting.NotifierPlugin

type Receiver struct {
	config.Receiver
	GrafanaManagedReceivers []*GrafanaReceiver
}
