package definitions

import (
	"fmt"
	"sort"
	"strings"
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
	RuleGroups []*RuleGroup     `json:"groups"`
	Totals     map[string]int64 `json:"totals,omitempty"`
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
	Rules  []AlertingRule   `json:"rules"`
	Totals map[string]int64 `json:"totals"`
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
	Alerts []Alert          `json:"alerts,omitempty"`
	Totals map[string]int64 `json:"totals,omitempty"`
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

type StateByImportance int

const (
	StateAlerting = iota
	StatePending
	StateError
	StateNoData
	StateNormal
)

func stateByImportanceFromString(s string) (StateByImportance, error) {
	switch s = strings.ToLower(s); s {
	case "alerting":
		return StateAlerting, nil
	case "pending":
		return StatePending, nil
	case "error":
		return StateError, nil
	case "nodata":
		return StateNoData, nil
	case "normal":
		return StateNormal, nil
	default:
		return -1, fmt.Errorf("unknown state: %s", s)
	}
}

func (a Alert) Less(v Alert) bool {
	// Compare the importance of each alert's state
	imp1, _ := stateByImportanceFromString(a.State)
	imp2, _ := stateByImportanceFromString(v.State)
	if imp1 == imp2 {
		// The first alert is active but not the second
		if a.ActiveAt != nil && v.ActiveAt == nil {
			return true
			// The second alert is active but not the first
		} else if a.ActiveAt == nil && v.ActiveAt != nil {
			return false
			// Both alerts are active so compare their timestamps
		} else if a.ActiveAt != nil && v.ActiveAt != nil && a.ActiveAt.Before(*v.ActiveAt) {
			return true
		}
		// Both alerts are active from the same time so compare the labels
		labels1, labels2 := sortLabels(a.Labels), sortLabels(v.Labels)
		if len(labels1) == len(labels2) {
			for i := range labels1 {
				if labels1[i] != labels2[i] {
					return labels1[i] < labels2[i]
				}
			}
		}
		return len(labels1) < len(labels2)
	}

	return imp1 < imp2
}

func sortLabels(m map[string]string) []string {
	s := make([]string, 0, len(m))
	for k, v := range m {
		s = append(s, k+v)
	}
	sort.Strings(s)
	return s
}

type SortableAlerts []Alert

func (s SortableAlerts) Len() int           { return len(s) }
func (s SortableAlerts) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }
func (s SortableAlerts) Less(i, j int) bool { return s[i].Less(s[j]) }

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
