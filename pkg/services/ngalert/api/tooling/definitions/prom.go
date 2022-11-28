package definitions

import (
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// swagger:route GET /api/prometheus/grafana/api/v1/rules prometheus RouteGetGrafanaRuleStatuses
//
// gets the evaluation statuses of all rules
//
//     Responses:
//       200: RuleResponse

// swagger:route GET /api/prometheus/{DatasourceUID}/api/v1/rules prometheus RouteGetRuleStatuses
//
// gets the evaluation statuses of all rules
//
//     Responses:
//       200: RuleResponse
//       404: NotFound

// swagger:route GET /api/prometheus/grafana/api/v1/alerts prometheus RouteGetGrafanaAlertStatuses
//
// gets the current alerts
//
//     Responses:
//       200: AlertResponse

// swagger:route GET /api/prometheus/{DatasourceUID}/api/v1/alerts prometheus RouteGetAlertStatuses
//
// gets the current alerts
//
//     Responses:
//       200: AlertResponse
//       404: NotFound

// swagger:model
type RuleResponse struct {
	// in: body
	DiscoveryBase
	// in: body
	Data RuleDiscovery `json:"data"`
}

// swagger:model
type AlertResponse struct {
	// in: body
	DiscoveryBase
	// in: body
	Data AlertDiscovery `json:"data"`
}

// swagger:model
type DiscoveryBase struct {
	// required: true
	Status string `json:"status"`
	// required: false
	ErrorType v1.ErrorType `json:"errorType,omitempty"`
	// required: false
	Error string `json:"error,omitempty"`
}

// swagger:model
type RuleDiscovery struct {
	// required: true
	RuleGroups []*RuleGroup `json:"groups"`
}

// AlertDiscovery has info for all active alerts.
// swagger:model
type AlertDiscovery struct {
	// required: true
	Alerts []*Alert `json:"alerts"`
}

// swagger:model
type RuleGroup struct {
	// required: true
	Name string `json:"name"`
	// required: true
	File string `json:"file"`
	// In order to preserve rule ordering, while exposing type (alerting or recording)
	// specific properties, both alerting and recording rules are exposed in the
	// same array.
	// required: true
	Rules []AlertingRule `json:"rules"`
	// required: true
	Interval       float64   `json:"interval"`
	LastEvaluation time.Time `json:"lastEvaluation"`
	EvaluationTime float64   `json:"evaluationTime"`
}

// adapted from cortex
// swagger:model
type AlertingRule struct {
	// State can be "pending", "firing", "inactive".
	// required: true
	State string `json:"state,omitempty"`
	// required: true
	Name string `json:"name,omitempty"`
	// required: true
	Query    string  `json:"query,omitempty"`
	Duration float64 `json:"duration,omitempty"`
	// required: true
	Annotations overrideLabels `json:"annotations,omitempty"`
	// required: true
	Alerts []*Alert `json:"alerts,omitempty"`
	Rule
}

// adapted from cortex
// swagger:model
type Rule struct {
	// required: true
	Name string `json:"name"`
	// required: true
	Query  string         `json:"query"`
	Labels overrideLabels `json:"labels,omitempty"`
	// required: true
	Health    string `json:"health"`
	LastError string `json:"lastError,omitempty"`
	// required: true
	Type           v1.RuleType `json:"type"`
	LastEvaluation time.Time   `json:"lastEvaluation"`
	EvaluationTime float64     `json:"evaluationTime"`
}

// Alert has info for an alert.
// swagger:model
type Alert struct {
	// required: true
	Labels overrideLabels `json:"labels"`
	// required: true
	Annotations overrideLabels `json:"annotations"`
	// required: true
	State    string     `json:"state"`
	ActiveAt *time.Time `json:"activeAt"`
	// required: true
	Value string `json:"value"`
}

// override the labels type with a map for generation.
// The custom marshaling for labels.Labels ends up doing this anyways.
type overrideLabels map[string]string

// swagger:parameters RouteGetGrafanaAlertStatuses
type GetGrafanaAlertStatusesParams struct {
	// Include Grafana specific labels as part of the response.
	// in: query
	// required: false
	// default: false
	IncludeInternalLabels bool `json:"includeInternalLabels"`
}

// swagger:parameters RouteGetGrafanaRuleStatuses
type GetGrafanaRuleStatusesParams struct {
	// Include Grafana specific labels as part of the response.
	// in: query
	// required: false
	// default: false
	IncludeInternalLabels bool `json:"includeInternalLabels"`

	// Filter the list of rules to those that belong to the specified dashboard UID.
	// in: query
	// required: false
	DashboardUID string

	// Filter the list of rules to those that belong to the specified panel ID. Dashboard UID must be specified.
	// in: query
	// required: false
	PanelID int64
}
