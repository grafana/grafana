package search

import (
	"sort"
	"strconv"
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
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
			case fieldLabels:
				f.labels = append(f.labels, requirementToLabelMatchers(r)...)
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
		// Group is carried as a controlled metadata label.
		for _, r := range opts.Labels {
			if r.Key == model.GroupLabelKey {
				f.groups = r.Values
			}
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

// labelMatcherRequirement / requirementToLabelMatchers translate label matchers
// to and from a requirement on the indexed "labels" field, using flattened
// "key"/"key=value" terms and in/notin operators so a matcher survives the
// request and resolves the same way on both backends.
func labelMatcherRequirement(m labelMatcher) *resourcepb.Requirement {
	r := &resourcepb.Requirement{Key: fieldLabels, Operator: "in"}
	switch m.op {
	case matchEquals:
		r.Values = []string{m.key + "=" + m.value}
	case matchNotEquals:
		r.Operator = "notin"
		r.Values = []string{m.key + "=" + m.value}
	case matchExists:
		r.Values = []string{m.key}
	case matchNotExists:
		r.Operator = "notin"
		r.Values = []string{m.key}
	}
	return r
}

func requirementToLabelMatchers(r *resourcepb.Requirement) []labelMatcher {
	negated := r.Operator == "notin" || r.Operator == "!="
	out := make([]labelMatcher, 0, len(r.Values))
	for _, term := range r.Values {
		if k, v, ok := strings.Cut(term, "="); ok {
			op := matchEquals
			if negated {
				op = matchNotEquals
			}
			out = append(out, labelMatcher{key: k, value: v, op: op})
			continue
		}
		op := matchExists
		if negated {
			op = matchNotExists
		}
		out = append(out, labelMatcher{key: term, op: op})
	}
	return out
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
