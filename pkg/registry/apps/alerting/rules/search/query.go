package search

import (
	"strconv"
	"strings"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// negateMatcher flips a matcher to its complement, so a NotIn labels filter
// negates each value's matcher. It is total over the four matcher ops.
func negateMatcher(m labelMatcher) labelMatcher {
	switch m.op {
	case matchEquals:
		m.op = matchNotEquals
	case matchNotEquals:
		m.op = matchEquals
	case matchExists:
		m.op = matchNotExists
	case matchNotExists:
		m.op = matchExists
	}
	return m
}

// filters is the backend-neutral view of a ResourceSearchRequest used by the
// legacy backend. The handler encodes these into the request; the legacy and
// unified backends each decode the request in their own way.
type filters struct {
	// title is the free-text query: a word search over the rule title, pushed
	// down as SearchTitle. A title filter leaf is rejected (see
	// legacyFilterableFields), so there is no exact-match counterpart.
	title          string
	names          []string
	folders        []string
	datasourceUIDs []string
	ruleType       string
	// labelMatchers holds one matcher per labels requirement. A rule must satisfy
	// all of them: requirements conjoin.
	labelMatchers []labelMatcher
	// groupsInclude/groupsExclude come from a labelSelector on the controlled
	// group metadata label, which the legacy backend applies through its
	// GroupFilter rather than as an indexed field.
	groupsInclude       []string
	groupsExclude       []string
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
	states              listFilter
	healths             listFilter
}

type listFilter struct {
	include []string
	exclude []string
}

func (l *listFilter) add(r *resourcepb.Requirement) {
	if r.Operator == "notin" {
		l.exclude = append(l.exclude, r.Values...)
		return
	}
	l.include = append(l.include, r.Values...)
}

func extractFilters(req *resourcepb.ResourceSearchRequest) filters {
	f := filters{title: req.Query}
	opts := req.Options
	if opts != nil {
		for _, r := range opts.Fields {
			switch r.Key {
			case fieldName:
				f.names = r.Values
			case fieldFolder:
				f.folders = r.Values
			case fieldType:
				f.ruleType = firstValue(r.Values)
			case fieldLabels:
				if len(r.Values) == 1 {
					f.labelMatchers = append(f.labelMatchers, requirementToLabelMatcher(r))
				}
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
			case fieldState:
				f.states.add(r)
			case fieldHealth:
				f.healths.add(r)
			}
		}
		// Metadata label requirements come from the labelSelector. Only the
		// controlled group label is selectable (see perKindSelectableLabelKeys), and the
		// legacy backend applies it through GroupFilter.
		for _, r := range opts.Labels {
			if r.Key != model.GroupLabelKey {
				continue
			}
			if r.Operator == "notin" {
				f.groupsExclude = append(f.groupsExclude, r.Values...)
				continue
			}
			f.groupsInclude = append(f.groupsInclude, r.Values...)
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

// labelMatcherRequirement / requirementToLabelMatcher translate a label matcher
// to and from a requirement on the indexed "labels" field, using flattened
// "key"/"key=value" terms and in/notin operators so a matcher survives the
// request and resolves the same way on both backends.
func labelMatcherRequirement(m labelMatcher) *resourcepb.Requirement {
	operator := "in"
	if labelMatcherIsNegated(m) {
		operator = "notin"
	}
	return &resourcepb.Requirement{Key: fieldLabels, Operator: operator, Values: []string{labelTerm(m)}}
}

// labelTerm is the indexed term for a matcher: a bare key for an existence
// check, "key=value" for an equality one. Negation is carried by the
// requirement's operator rather than the term, so the negated and non-negated
// forms of a matcher share a term.
func labelTerm(m labelMatcher) string {
	if m.op == matchExists || m.op == matchNotExists {
		return m.key
	}
	return m.key + "=" + m.value
}

func labelMatcherIsNegated(m labelMatcher) bool {
	return m.op == matchNotEquals || m.op == matchNotExists
}

// requirementToLabelMatcher rebuilds the matcher a labels requirement encodes.
// The term carries the key and value, the operator carries the polarity.
func requirementToLabelMatcher(r *resourcepb.Requirement) labelMatcher {
	negated := r.Operator == "notin" || r.Operator == "!="
	if k, v, ok := strings.Cut(r.Values[0], "="); ok {
		op := matchEquals
		if negated {
			op = matchNotEquals
		}
		return labelMatcher{key: k, value: v, op: op}
	}
	op := matchExists
	if negated {
		op = matchNotExists
	}
	return labelMatcher{key: r.Values[0], op: op}
}

// matchLabels returns true when a rule satisfies every matcher. Each labels
// filter leaf carries one matcher, and separate leaves conjoin.
func matchLabels(r *ngmodels.AlertRule, matchers []labelMatcher) bool {
	for _, m := range matchers {
		if !matchLabel(r, m) {
			return false
		}
	}
	return true
}

func matchLabel(r *ngmodels.AlertRule, m labelMatcher) bool {
	v, ok := r.Labels[m.key]
	switch m.op {
	case matchExists:
		return ok
	case matchNotExists:
		return !ok
	case matchEquals:
		return ok && v == m.value
	case matchNotEquals:
		return !ok || v != m.value
	}
	return false
}

// isQueryDatasource reports whether a UID names a datasource a user actually
// queries, as opposed to a synthetic node: the __expr__/-100 command nodes and
// the __ml__ node are not. expr.NodeTypeFromDatasourceUID is the single source
// of truth, so a synthetic UID added to pkg/expr is covered here without this
// needing to change. The unified document builder classifies them the same way
// (see appendSourceUID in search/builders/alertingrules.go).
func isQueryDatasource(uid string) bool {
	return uid != "" && expr.NodeTypeFromDatasourceUID(uid) == expr.TypeDatasourceNode
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

func listStringFilter(f listFilter) provisioning.ListRuleStringFilter {
	return provisioning.ListRuleStringFilter{Include: f.include, Exclude: f.exclude}
}
