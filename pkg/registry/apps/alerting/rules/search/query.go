package search

import (
	"sort"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// filters is the backend-neutral view of a ResourceSearchRequest used by the
// legacy backend. The handler encodes these into the request; the legacy and
// unified backends each decode the request in their own way.
type filters struct {
	text                string
	folders             []string
	groups              []string
	datasourceUIDs      []string
	labels              []labelMatcher
	paused              *bool
	dashboardUID        string
	panelID             string
	receiver            string
	notificationType    string
	routingTree         string
	metric              string
	targetDatasourceUID string
	sortField           string
	sortDesc            bool
}

func extractFilters(req *resourcepb.ResourceSearchRequest) filters {
	f := filters{text: req.Query}
	opts := req.Options
	if opts != nil {
		for _, r := range opts.Fields {
			switch r.Key {
			case fieldFolder:
				f.folders = r.Values
			case fieldGroup:
				f.groups = r.Values
			case fieldDatasourceUIDs:
				f.datasourceUIDs = r.Values
			case fieldPaused:
				if len(r.Values) == 1 {
					if b, err := strconv.ParseBool(r.Values[0]); err == nil {
						f.paused = &b
					}
				}
			case fieldDashboardUID:
				f.dashboardUID = firstValue(r.Values)
			case fieldPanelID:
				f.panelID = firstValue(r.Values)
			case fieldReceiver:
				f.receiver = firstValue(r.Values)
			case fieldNotificationType:
				f.notificationType = firstValue(r.Values)
			case fieldRoutingTree:
				f.routingTree = firstValue(r.Values)
			case fieldMetric:
				f.metric = firstValue(r.Values)
			case fieldTargetDatasourceUID:
				f.targetDatasourceUID = firstValue(r.Values)
			}
		}
		for _, r := range opts.Labels {
			f.labels = append(f.labels, requirementToMatcher(r))
		}
	}
	if len(req.SortBy) > 0 {
		f.sortField = req.SortBy[0].Field
		f.sortDesc = req.SortBy[0].Desc
	}
	return f
}

func firstValue(values []string) string {
	if len(values) == 0 {
		return ""
	}
	return values[0]
}

type labelMatcher struct {
	key   string
	value string
	op    matcherOp
}

type matcherOp int

const (
	matchEquals matcherOp = iota
	matchNotEquals
	matchExists
	matchNotExists
)

// parseLabelMatcher parses a "labels" query value: key=value, key!=value, key
// (exists) or !key (not exists).
func parseLabelMatcher(s string) labelMatcher {
	if rest, ok := strings.CutPrefix(s, "!"); ok {
		return labelMatcher{key: rest, op: matchNotExists}
	}
	if k, v, ok := strings.Cut(s, "!="); ok {
		return labelMatcher{key: k, value: v, op: matchNotEquals}
	}
	if k, v, ok := strings.Cut(s, "="); ok {
		return labelMatcher{key: k, value: v, op: matchEquals}
	}
	return labelMatcher{key: s, op: matchExists}
}

// requirementToMatcher / matcherToRequirement translate a label matcher to and
// from a ResourceSearchRequest label requirement so it survives the request.
func requirementToMatcher(r *resourcepb.Requirement) labelMatcher {
	m := labelMatcher{key: r.Key, value: firstValue(r.Values)}
	switch selection.Operator(r.Operator) {
	case selection.NotEquals:
		m.op = matchNotEquals
	case selection.Exists:
		m.op = matchExists
	case selection.DoesNotExist:
		m.op = matchNotExists
	default:
		m.op = matchEquals
	}
	return m
}

func matcherToRequirement(m labelMatcher) *resourcepb.Requirement {
	r := &resourcepb.Requirement{Key: m.key}
	switch m.op {
	case matchNotEquals:
		r.Operator = string(selection.NotEquals)
		r.Values = []string{m.value}
	case matchExists:
		r.Operator = string(selection.Exists)
	case matchNotExists:
		r.Operator = string(selection.DoesNotExist)
	default:
		r.Operator = string(selection.Equals)
		r.Values = []string{m.value}
	}
	return r
}

func matchText(r *ngmodels.AlertRule, text string) bool {
	if text == "" {
		return true
	}
	return strings.Contains(strings.ToLower(r.Title), strings.ToLower(text))
}

// matchLabels returns true when every matcher holds against the rule labels.
func matchLabels(r *ngmodels.AlertRule, matchers []labelMatcher) bool {
	for _, m := range matchers {
		v, ok := r.Labels[m.key]
		switch m.op {
		case matchExists:
			if !ok {
				return false
			}
		case matchNotExists:
			if ok {
				return false
			}
		case matchEquals:
			if !ok || v != m.value {
				return false
			}
		case matchNotEquals:
			if ok && v == m.value {
				return false
			}
		}
	}
	return true
}

// serverSideDatasourceUIDs are the synthetic datasources used for expression
// nodes; they are never user-facing query datasources.
var serverSideDatasourceUIDs = map[string]struct{}{
	expr.DatasourceUID:    {},
	expr.OldDatasourceUID: {},
	expr.MLDatasourceUID:  {},
}

// matchDatasources returns true when the rule references any of the requested
// source datasources in its query expressions.
func matchDatasources(r *ngmodels.AlertRule, uids []string) bool {
	if len(uids) == 0 {
		return true
	}
	have := make(map[string]struct{}, len(r.Data))
	for _, q := range r.Data {
		if _, server := serverSideDatasourceUIDs[q.DatasourceUID]; server || q.DatasourceUID == "" {
			continue
		}
		have[q.DatasourceUID] = struct{}{}
	}
	for _, want := range uids {
		if _, ok := have[want]; ok {
			return true
		}
	}
	return false
}

func sortRules(rules []*ngmodels.AlertRule, field string, desc bool) {
	var less func(a, b *ngmodels.AlertRule) bool
	switch field {
	case fieldGroup:
		// Compound key keeps each group together and in evaluation order.
		less = func(a, b *ngmodels.AlertRule) bool {
			if a.NamespaceUID != b.NamespaceUID {
				return a.NamespaceUID < b.NamespaceUID
			}
			if a.RuleGroup != b.RuleGroup {
				return a.RuleGroup < b.RuleGroup
			}
			if a.RuleGroupIndex != b.RuleGroupIndex {
				return a.RuleGroupIndex < b.RuleGroupIndex
			}
			return a.Title < b.Title
		}
	default:
		less = func(a, b *ngmodels.AlertRule) bool {
			if a.Title != b.Title {
				return a.Title < b.Title
			}
			return a.UID < b.UID
		}
	}
	sort.SliceStable(rules, func(i, j int) bool {
		if desc {
			return less(rules[j], rules[i])
		}
		return less(rules[i], rules[j])
	})
}

func includeFilter(values []string) provisioning.ListRuleStringFilter {
	if len(values) == 0 {
		return provisioning.ListRuleStringFilter{}
	}
	return provisioning.ListRuleStringFilter{Include: values}
}

func stringFilter(value string) provisioning.ListRuleStringFilter {
	if value == "" {
		return provisioning.ListRuleStringFilter{}
	}
	return provisioning.ListRuleStringFilter{Include: []string{value}}
}
