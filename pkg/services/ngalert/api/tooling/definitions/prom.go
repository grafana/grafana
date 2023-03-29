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
	RuleGroups []RuleGroup      `json:"groups"`
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

// RuleGroupsBy is a function that defines the ordering of Rule Groups.
type RuleGroupsBy func(a1, a2 *RuleGroup) bool

func (by RuleGroupsBy) Sort(groups []RuleGroup) {
	sort.Sort(RuleGroupsSorter{groups: groups, by: by})
}

func RuleGroupsByFileAndName(a1, a2 *RuleGroup) bool {
	if a1.File == a2.File {
		return a1.Name < a2.Name
	}
	return a1.File < a2.File
}

type RuleGroupsSorter struct {
	groups []RuleGroup
	by     RuleGroupsBy
}

func (s RuleGroupsSorter) Len() int           { return len(s.groups) }
func (s RuleGroupsSorter) Swap(i, j int)      { s.groups[i], s.groups[j] = s.groups[j], s.groups[i] }
func (s RuleGroupsSorter) Less(i, j int) bool { return s.by(&s.groups[i], &s.groups[j]) }

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

// AlertsBy is a function that defines the ordering of alerts.
type AlertsBy func(a1, a2 *Alert) bool

func (by AlertsBy) Sort(alerts []Alert) {
	sort.Sort(AlertsSorter{alerts: alerts, by: by})
}

// AlertsByImportance orders alerts by importance. An alert is more important
// than another alert if its status has higher importance. For example, "alerting"
// is more important than "normal". If two alerts have the same importance
// then the ordering is based on their ActiveAt time and their labels.
func AlertsByImportance(a1, a2 *Alert) bool {
	// labelsForComparison concatenates each key/value pair into a string and
	// sorts them.
	labelsForComparison := func(m map[string]string) []string {
		s := make([]string, 0, len(m))
		for k, v := range m {
			s = append(s, k+v)
		}
		sort.Strings(s)
		return s
	}

	// compareLabels returns true if labels1 are less than labels2. This happens
	// when labels1 has fewer labels than labels2, or if the next label from
	// labels1 is lexicographically less than the next label from labels2.
	compareLabels := func(labels1, labels2 []string) bool {
		if len(labels1) == len(labels2) {
			for i := range labels1 {
				if labels1[i] != labels2[i] {
					return labels1[i] < labels2[i]
				}
			}
		}
		return len(labels1) < len(labels2)
	}

	// The importance of an alert is first based on the importance of their states.
	// This ordering is intended to show the most important alerts first when
	// using pagination.
	importance1, _ := stateByImportanceFromString(a1.State)
	importance2, _ := stateByImportanceFromString(a2.State)

	// If both alerts have the same importance then the ordering is based on
	// their ActiveAt time, and if those are equal, their labels.
	if importance1 == importance2 {
		if a1.ActiveAt != nil && a2.ActiveAt == nil {
			// The first alert is active but not the second
			return true
		} else if a1.ActiveAt == nil && a2.ActiveAt != nil {
			// The second alert is active but not the first
			return false
		} else if a1.ActiveAt != nil && a2.ActiveAt != nil && a1.ActiveAt.Before(*a2.ActiveAt) {
			// Both alerts are active but a1 happened before a2
			return true
		}
		// Both alerts are active since the same time so compare their labels
		labels1 := labelsForComparison(a1.Labels)
		labels2 := labelsForComparison(a2.Labels)
		return compareLabels(labels1, labels2)
	}

	return importance1 < importance2
}

type AlertsSorter struct {
	alerts []Alert
	by     AlertsBy
}

func (s AlertsSorter) Len() int           { return len(s.alerts) }
func (s AlertsSorter) Swap(i, j int)      { s.alerts[i], s.alerts[j] = s.alerts[j], s.alerts[i] }
func (s AlertsSorter) Less(i, j int) bool { return s.by(&s.alerts[i], &s.alerts[j]) }

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
