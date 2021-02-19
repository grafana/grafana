package api

import (
	"github.com/grafana/grafana/pkg/services/alerting"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/alertmanager/config"
)

// swagger:route POST /api/v1/config alertmanager RoutePostAlertingConfig
//
// sets an Alerting config
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route GET /api/v1/config alertmanager RouteGetAlertingConfig
//
// gets an Alerting config
//
//     Responses:
//       200: AlertingConfigResponse
//       400: ValidationError

// swagger:route DELETE /api/v1/config alertmanager RouteDeleteAlertingConfig
//
// deletes the Alerting config for a tenant
//
//     Responses:
//       200: Ack
//       400: ValidationError

// swagger:route GET /api/v1/alerts alertmanager RouteGetAmAlerts
//
// get alertmanager alerts
//
//     Responses:
//       200: GettableAlerts
//       400: ValidationError

// swagger:route GET /api/v1/alerts/groups alertmanager RouteGetAmAlertGroups
//
// get alertmanager alerts
//
//     Responses:
//       200: AlertGroups
//       400: ValidationError

// swagger:model
type GettableAlerts amv2.GettableAlerts

// swagger:model
type AlertGroups amv2.AlertGroups

// swagger:parameters RouteGetAmAlerts RouteGetAmAlertGroups
type AlertsParams struct {

	// Show active alerts
	// in: query
	// required: false
	Active bool `json:"active"`

	// Show silenced alerts
	// in: query
	// required: false
	Silenced bool `json:"silenced"`

	// Show inhibited alerts
	// in: query
	// required: false
	Inhibited bool `json:"inhibited"`

	// A list of matchers to filter alerts by
	// in: query
	// required: false
	Matchers []string `json:"matchers"`

	// A list of receivers to filter alerts by
	// in: query
	// required: false
	Receivers []string `json:"receivers"`
}

// swagger:parameters RoutePostAlertingConfig
type BodyAlertingConfig struct {
	// in:body
	Body UserConfig
}

// swagger:model
type UserConfig struct {
	TemplateFiles      map[string]string `yaml:"template_files" json:"template_files"`
	AlertmanagerConfig ApiAlertingConfig `yaml:"alertmanager_config" json:"alertmanager_config"`
}

// swagger:model
type AlertingConfigResponse struct {
	BodyAlertingConfig
}

type ApiAlertingConfig struct {
	config.Config

	// Override with our superset receiver type
	Receivers []*ApiReceiver `yaml:"receivers,omitempty" json:"receivers,omitempty"`
}

type GrafanaReceiver alerting.NotifierPlugin

type ApiReceiver struct {
	config.Receiver
	GrafanaManagedReceivers []*GrafanaReceiver `yaml:"grafana_managed_receiver_configs,omitempty" json:"grafana_managed_receiver_configs,omitempty"`
}
