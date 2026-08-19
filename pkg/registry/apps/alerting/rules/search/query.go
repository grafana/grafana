package search

import (
	"sort"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Wire values shared with the generic search contract. Spelled as constants
// rather than reaching for the generated per-route enums, because the handler
// speaks searchv0 types and there is one set of these per route.
const (
	filterOperatorIn    = "In"
	filterOperatorNotIn = "NotIn"

	sortAscending  = "asc"
	sortDescending = "desc"
)

// validRuleTypes are the accepted values of a "type" filter, which is the
// indexed discriminator each kind's documents carry.
var validRuleTypes = map[string]struct{}{
	ruleTypeAlerting:  {},
	ruleTypeRecording: {},
}

// validNotificationTypes are the accepted values of a "notificationType" filter.
// Taken from the ngalert constants rather than restated, because the legacy store
// turns any other value into a query error rather than an empty result.
var validNotificationTypes = map[string]struct{}{
	string(ngmodels.NotificationSettingsTypeSimplifiedRouting): {},
	string(ngmodels.NotificationSettingsTypeNamedRoutingTree):  {},
}

func ruleTypeNames() []string {
	return sortedKeys(validRuleTypes)
}

func notificationTypeNames() []string {
	return sortedKeys(validNotificationTypes)
}

func sortedKeys(m map[string]struct{}) []string {
	names := make([]string, 0, len(m))
	for name := range m {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// defaultReturnFields is what a hit carries when the query names no fields. It
// matches the generic search API's default so the projection does not change
// when that endpoint takes over.
var defaultReturnFields = []string{fieldTitle, fieldFolder}

// translated is a validated query lowered onto the backend request, plus the
// parts of it the response layer needs.
type translated struct {
	req *resourcepb.ResourceSearchRequest
	// offset is where this page starts, so the response can compute the next
	// page's token.
	offset int64
	// fields are the resolved return fields. The backend is asked for every
	// column regardless (see req.Fields), so the projection happens when the
	// response is built.
	fields []string
}

// translateQuery lowers a validated SearchQuery onto a ResourceSearchRequest for
// one kind. The where tree is flattened: the text leaf becomes the free-text
// query, filter leaves become field requirements, and the labelSelector becomes
// metadata label requirements.
//
// It assumes validateQuery has already passed, so it does not re-check anything.
func translateQuery(q *searchv0.SearchQuery, leaves []searchv0.WhereNode, namespace string, k kind) translated {
	// A cursor that failed to decode is a validation error, so by here it parses.
	offset, _ := decodeCursor(q.Continue)

	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(namespace, k.groupResource())},
		Limit:   resolveLimit(q.Limit),
		Offset:  offset,
		// HACK: this should be implicit but bleve doesn't populate all the columns for free text filters
		// we can remove this once that behavior is fixed.
		Fields: append([]string{}, resultColumns...),
	}

	applyLeaves(req, leaves)
	applyLabelSelector(req, q.LabelSelector)
	applySort(req, q.Sort)

	return translated{req: req, offset: offset, fields: resolveReturnFields(q.Fields)}
}

func resolveLimit(limit int64) int64 {
	switch {
	case limit <= 0:
		return defaultLimit
	case limit > maxLimit:
		return maxLimit
	default:
		return limit
	}
}

func resolveReturnFields(fields []string) []string {
	if len(fields) == 0 {
		return defaultReturnFields
	}
	return fields
}

func applyLeaves(req *resourcepb.ResourceSearchRequest, leaves []searchv0.WhereNode) {
	for i := range leaves {
		switch n := leaves[i]; {
		case n.Text != nil:
			req.Query = n.Text.Value
		case n.Filter != nil:
			req.Options.Fields = append(req.Options.Fields, filterRequirement(n.Filter))
		}
	}
}

// filterRequirement maps a filter leaf onto a field requirement. The labels field
// is special: its values are label matchers flattened into indexed terms.
func filterRequirement(f *searchv0.FilterPredicate) *resourcepb.Requirement {
	if f.Field == fieldLabels {
		// Validation holds labels to exactly one value (see scalarFilterFields).
		m := parseLabelMatcher(f.Values[0])
		if f.Operator == filterOperatorNotIn {
			// NotIn is the matcher's complement, which the requirement carries by
			// flipping its operator rather than negating the term.
			m = negateMatcher(m)
		}
		return labelMatcherRequirement(m)
	}
	return &resourcepb.Requirement{Key: f.Field, Operator: filterOperator(f.Operator), Values: f.Values}
}

func filterOperator(op string) string {
	if op == filterOperatorNotIn {
		return "notin"
	}
	return "in"
}

// applyLabelSelector lowers the selector onto the request's metadata label
// requirements, using the same encoding as the generic translation. A multi-value
// In stays one requirement so its values OR rather than conjoin.
func applyLabelSelector(req *resourcepb.ResourceSearchRequest, sel *metav1.LabelSelector) {
	if sel == nil {
		return
	}
	// Sorted so the generated request is deterministic.
	keys := make([]string, 0, len(sel.MatchLabels))
	for k := range sel.MatchLabels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key: k, Operator: "in", Values: []string{sel.MatchLabels[k]},
		})
	}
	for _, r := range sel.MatchExpressions {
		op := "in"
		if r.Operator == metav1.LabelSelectorOpNotIn {
			op = "notin"
		}
		req.Options.Labels = append(req.Options.Labels, &resourcepb.Requirement{
			Key: r.Key, Operator: op, Values: r.Values,
		})
	}
}

// applySort maps the requested sort onto the request. An explicit default keeps
// free-text results stable across storage modes: legacy defaults to title while
// unified storage otherwise defaults to relevance.
func applySort(req *resourcepb.ResourceSearchRequest, sorts []searchv0.SortField) {
	if len(sorts) == 0 {
		sorts = []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}}
	}
	for _, s := range sorts {
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{
			Field: s.Field,
			Desc:  s.Direction == sortDescending,
		})
	}
}

// negateMatcher flips a matcher to its complement, so a NotIn labels filter
// negates its value's matcher. It is total over the four matcher ops.
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

func resourceKey(namespace string, gr schema.GroupResource) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource}
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
	// ruleType is a "type" filter's value, empty when the query has none. The
	// endpoint already narrows to one kind, so this only ever confirms or
	// contradicts that kind.
	ruleType string
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
			}
		}
		// Metadata label requirements come from the labelSelector. Only the
		// controlled group label is selectable (see selectableLabelKeys), and the
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

func sortRules(rules []*ngmodels.AlertRule, field string, desc bool) {
	// title is the only sortable field the contract exposes today; any other
	// value falls through to the same stable title ordering.
	_ = field
	less := func(a, b *ngmodels.AlertRule) bool {
		aTitle := strings.ToLower(a.Title)
		bTitle := strings.ToLower(b.Title)
		if aTitle != bTitle {
			if desc {
				return aTitle > bTitle
			}
			return aTitle < bTitle
		}
		// Unified storage appends resource name ascending as a stable tie-break,
		// even when the requested title order is descending.
		return a.UID < b.UID
	}
	sort.SliceStable(rules, func(i, j int) bool { return less(rules[i], rules[j]) })
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
