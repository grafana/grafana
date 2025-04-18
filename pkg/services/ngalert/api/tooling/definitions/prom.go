package definitions

import (
	"container/heap"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	v1 "github.com/prometheus/client_golang/api/prometheus/v1"
	promlabels "github.com/prometheus/prometheus/model/labels"
)

// swagger:route GET /prometheus/grafana/api/v1/rules prometheus RouteGetGrafanaRuleStatuses
//
// gets the evaluation statuses of all rules
//
//     Responses:
//       200: RuleResponse

// swagger:route GET /prometheus/{DatasourceUID}/api/v1/rules prometheus RouteGetRuleStatuses
//
// gets the evaluation statuses of all rules
//
//     Responses:
//       200: RuleResponse
//       404: NotFound

// swagger:route GET /prometheus/grafana/api/v1/alerts prometheus RouteGetGrafanaAlertStatuses
//
// gets the current alerts
//
//     Responses:
//       200: AlertResponse

// swagger:route GET /prometheus/{DatasourceUID}/api/v1/alerts prometheus RouteGetAlertStatuses
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
	NextToken  string           `json:"groupNextToken,omitempty"`
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
	// required: true
	FolderUID string `json:"folderUid"`
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

// HTTPStatusCode returns the HTTP status code for a given Prometheus style error.
func (d DiscoveryBase) HTTPStatusCode() int {
	if d.Status == "success" {
		return http.StatusOK
	}

	// Mapping taken from prometheus/web/api/v1/api.go
	// Note this is not exhaustive as our API does not return
	// the same spectrum of errors as Prometheus does.
	switch d.ErrorType {
	case v1.ErrBadData:
		return http.StatusBadRequest
	default:
		return http.StatusInternalServerError
	}
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
	Query                 string   `json:"query,omitempty"`
	QueriedDatasourceUIDs []string `json:"queriedDatasourceUIDs,omitempty"`
	Duration              float64  `json:"duration,omitempty"`
	KeepFiringFor         float64  `json:"keepFiringFor,omitempty"`
	// required: true
	Annotations promlabels.Labels `json:"annotations,omitempty"`
	// required: true
	ActiveAt       *time.Time       `json:"activeAt,omitempty"`
	Alerts         []Alert          `json:"alerts,omitempty"`
	Totals         map[string]int64 `json:"totals,omitempty"`
	TotalsFiltered map[string]int64 `json:"totalsFiltered,omitempty"`
	Rule
}

// adapted from cortex
// swagger:model
type Rule struct {
	UID string `json:"uid,omitempty"`
	// required: true
	Name      string `json:"name"`
	FolderUID string `json:"folderUid,omitempty"`
	// required: true
	Query  string            `json:"query"`
	Labels promlabels.Labels `json:"labels,omitempty"`
	// required: true
	Health    string `json:"health"`
	LastError string `json:"lastError,omitempty"`
	// required: true
	Type           string    `json:"type"`
	LastEvaluation time.Time `json:"lastEvaluation"`
	EvaluationTime float64   `json:"evaluationTime"`
}

// Alert has info for an alert.
// swagger:model
type Alert struct {
	// required: true
	Labels promlabels.Labels `json:"labels"`
	// required: true
	Annotations promlabels.Labels `json:"annotations"`
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

// AlertsHeap extends AlertsSorter for use with container/heap functions.
type AlertsHeap struct {
	AlertsSorter
}

func (h *AlertsHeap) Push(x any) {
	h.alerts = append(h.alerts, x.(Alert))
}

func (h *AlertsHeap) Pop() any {
	old := h.alerts
	n := len(old)
	x := old[n-1]
	h.alerts = old[0 : n-1]
	return x
}

// TopK returns the highest k elements. It does not modify the input.
func (by AlertsBy) TopK(alerts []Alert, k int) []Alert {
	// Concept is that instead of sorting the whole list and taking the number
	// of items we need, maintain a heap of the top k elements, and update it
	// for each element. This vastly reduces the number of comparisons needed,
	// which is important for sorting alerts, as the comparison function is
	// very expensive.

	// If k is zero or less, return nothing.
	if k < 1 {
		return []Alert{}
	}

	// The heap must be in ascending order, so that the root of the heap is
	// the current smallest element.
	byAscending := func(a1, a2 *Alert) bool { return by(a2, a1) }

	h := AlertsHeap{
		AlertsSorter: AlertsSorter{
			alerts: make([]Alert, 0, k),
			by:     byAscending,
		},
	}

	// Go version of this algorithm taken from Prometheus (promql/engine.go)

	heap.Init(&h)
	for i := 0; i < len(alerts); i++ {
		a := alerts[i]

		// We build a heap of up to k elements, with the smallest element at heap[0].
		switch {
		case len(h.alerts) < k:
			heap.Push(&h, a)

		case h.by(&h.alerts[0], &a):
			// This new element is bigger than the previous smallest element - overwrite that.
			h.alerts[0] = a
			// Maintain the heap invariant.
			if k > 1 {
				heap.Fix(&h, 0)
			}
		}
	}

	// The heap keeps the lowest value on top, so reverse it.
	if len(h.alerts) > 1 {
		sort.Sort(sort.Reverse(&h))
	}

	return h.alerts
}

// AlertsByImportance orders alerts by importance. An alert is more important
// than another alert if its status has higher importance. For example, "alerting"
// is more important than "normal". If two alerts have the same importance
// then the ordering is based on their ActiveAt time and their labels.
func AlertsByImportance(a1, a2 *Alert) bool {
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
		return promlabels.Compare(a1.Labels, a2.Labels) < 0
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

// LabelsFromMap creates Labels from a map. Note the Labels type requires the
// labels be sorted, so we make sure to do that.
func LabelsFromMap(m map[string]string) promlabels.Labels {
	sb := promlabels.NewScratchBuilder(len(m))
	for k, v := range m {
		sb.Add(k, v)
	}
	sb.Sort()
	return sb.Labels()
}

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
