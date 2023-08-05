package definitions

import (
	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// swagger:route GET /api/v1/ngalert configuration RouteGetStatus
//
//  Get the status of the alerting engine
//
//     Produces:
//     - application/json
//
//     Responses:
//		 200: AlertingStatus

// swagger:route GET /api/v1/ngalert/alertmanagers configuration RouteGetAlertmanagers
//
//  Get the discovered and dropped Alertmanagers of the user's organization based on the specified configuration.
//
//     Produces:
//     - application/json
//
//     Responses:
//		 200: GettableAlertmanagers

// swagger:route GET /api/v1/ngalert/admin_config configuration RouteGetNGalertConfig
//
//  Get the NGalert configuration of the user's organization, returns 404 if no configuration is present.
//
//     Produces:
//     - application/json
//
//     Responses:
//		 200: GettableNGalertConfig
//		 404: Failure
//		 500: Failure

// swagger:route POST /api/v1/ngalert/admin_config configuration RoutePostNGalertConfig
//
// Creates or updates the NGalert configuration of the user's organization. If no value is sent for alertmanagersChoice, it defaults to "all".
//
//     Consumes:
//     - application/json
//
//     Responses:
//       201: Ack
//       400: ValidationError

// swagger:route DELETE /api/v1/ngalert/admin_config configuration RouteDeleteNGalertConfig
//
// Deletes the NGalert configuration of the user's organization.
//
//     Consumes:
//     - application/json
//
//     Responses:
//       200: Ack
//       500: Failure

// swagger:parameters RoutePostNGalertConfig
type NGalertConfig struct {
	// in:body
	Body PostableNGalertConfig
}

// swagger:enum AlertmanagersChoice
type AlertmanagersChoice string

const (
	AllAlertmanagers           AlertmanagersChoice = "all"
	InternalAlertmanager       AlertmanagersChoice = "internal"
	ExternalAlertmanagers      AlertmanagersChoice = "external"
	HandleGrafanaManagedAlerts                     = "handleGrafanaManagedAlerts"
)

// swagger:model
type PostableNGalertConfig struct {
	AlertmanagersChoice AlertmanagersChoice `json:"alertmanagersChoice"`
}

// swagger:model
type GettableNGalertConfig struct {
	AlertmanagersChoice AlertmanagersChoice `json:"alertmanagersChoice"`
}

// swagger:model
type GettableAlertmanagers struct {
	Status string                 `json:"status"`
	Data   v1.AlertManagersResult `json:"data"`
}

// swagger:model
type AlertingStatus struct {
	AlertmanagersChoice      AlertmanagersChoice `json:"alertmanagersChoice"`
	NumExternalAlertmanagers int                 `json:"numExternalAlertmanagers"`
}
