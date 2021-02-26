package api

import (
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
)

// swagger:route GET /prometheus/api/v1/rules prometheus RouteGetRuleStatuses
//
// gets the evaluation statuses of all rules
//
//     Responses:
//       200: RuleResponse

// swagger:route GET /prometheus/api/v1/alerts prometheus RouteGetAlertStatuses
//
// gets the current alerts
//
//     Responses:
//       200: AlertResponse

// swagger:model
type RuleResponse struct {
	// in: body
	Body struct {
		discoveryBase
		Data RuleDiscovery `json:"data"`
	}
}

// swagger:model
type AlertResponse struct {
	// in: body
	Body struct {
		discoveryBase
		Data AlertDiscovery `json:"data"`
	}
}

type discoveryBase struct {
	Status    string       `json:"status"`
	ErrorType v1.ErrorType `json:"errorType"`
	Error     string       `json:"error"`
}

type RuleDiscovery struct {
	RuleGroups []*RuleGroup `json:"groups"`
}

// AlertDiscovery has info for all active alerts.
type AlertDiscovery struct {
	Alerts []*Alert `json:"alerts"`
}

type RuleGroup struct {
	Name string `json:"name"`
	File string `json:"file"`
	// In order to preserve rule ordering, while exposing type (alerting or recording)
	// specific properties, both alerting and recording rules are exposed in the
	// same array.
	Rules          []AlertingRule `json:"rules"`
	Interval       float64        `json:"interval"`
	LastEvaluation time.Time      `json:"lastEvaluation"`
	EvaluationTime float64        `json:"evaluationTime"`
}

// adapted from cortex
type AlertingRule struct {
	// State can be "pending", "firing", "inactive".
	State       string   `json:"state,omitempty"`
	Name        string   `json:"name,omitempty"`
	Query       string   `json:"query,omitempty"`
	Duration    float64  `json:"duration,omitempty"`
	Annotations labels   `json:"annotations,omitempty"`
	Alerts      []*Alert `json:"alerts,omitempty"`
	Rule
}

// adapted from cortex
type Rule struct {
	Name           string      `json:"name"`
	Query          string      `json:"query"`
	Labels         labels      `json:"labels"`
	Health         string      `json:"health"`
	LastError      string      `json:"lastError"`
	Type           v1.RuleType `json:"type"`
	LastEvaluation time.Time   `json:"lastEvaluation"`
	EvaluationTime float64     `json:"evaluationTime"`
}

// Alert has info for an alert.
type Alert struct {
	Labels      labels     `json:"labels"`
	Annotations labels     `json:"annotations"`
	State       string     `json:"state"`
	ActiveAt    *time.Time `json:"activeAt"`
	Value       string     `json:"value"`
}

// override the labels type with a map for generation.
// The custom marshaling for labels.Labels ends up doing this anyways.
type labels map[string]string
