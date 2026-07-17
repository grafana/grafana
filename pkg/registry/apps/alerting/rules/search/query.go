package search

import (
	"fmt"
	"sort"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// filterableFields are the field names a filter leaf may target. They mirror
// the kinds' declared searchFields (see the alertRule/recordingRule CUE); the
// standard name/title/folder fields are included so identity and display fields
// can be filtered too. A filter on any other field is rejected rather than
// silently ignored, so a client learns its query targets an unindexed field.
// Note: some entries here are further constrained by validateFilterLeaf (e.g.
// the legacy backend cannot yet filter every indexed field, see
// legacyUnsupportedFilterFields).
var filterableFields = map[string]struct{}{
	fieldName:                {},
	fieldTitle:               {},
	fieldFolder:              {},
	fieldType:                {},
	fieldInterval:            {},
	fieldPaused:              {},
	fieldLabels:              {},
	fieldDatasourceUIDs:      {},
	fieldAnnotations:         {},
	fieldFor:                 {},
	fieldKeepFiringFor:       {},
	fieldDashboardUID:        {},
	fieldPanelID:             {},
	fieldReceiver:            {},
	fieldNotificationType:    {},
	fieldRoutingTree:         {},
	fieldMetric:              {},
	fieldTargetDatasourceUID: {},
}

// buildSearchRequest translates a SearchQuery body into a ResourceSearchRequest
// for the primary kind, federating the given kinds. It returns the resolved
// offset so the handler can compute the next page token. The where tree is
// flattened: text leaves become the free-text query, filter leaves become field
// requirements, and the labelSelector becomes label-field requirements.
func buildSearchRequest(body model.CreateSearchRulesRequestBody, namespace string, primary schema.GroupResource, federated []schema.GroupResource) (*resourcepb.ResourceSearchRequest, int64, error) {
	limit := int64(defaultLimit)
	if body.Limit != nil {
		if *body.Limit <= 0 {
			return nil, 0, fmt.Errorf("invalid limit %d: must be a positive integer", *body.Limit)
		}
		limit = *body.Limit
	}
	if limit > maxLimit {
		limit = maxLimit
	}

	var offset int64
	if body.Continue != nil && *body.Continue != "" {
		n, err := strconv.ParseInt(*body.Continue, 10, 64)
		if err != nil || n < 0 {
			return nil, 0, fmt.Errorf("invalid continue token %q", *body.Continue)
		}
		offset = n
	}

	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(namespace, primary)},
		Limit:   limit,
		Offset:  offset,
	}
	for _, gr := range federated {
		req.Federated = append(req.Federated, resourceKey(namespace, gr))
	}

	// Field projection and facets are part of the contract shape but not yet
	// served. Reject them rather than silently ignore, so a client is not misled
	// into thinking a projected/faceted response was honored.
	if len(body.Fields) > 0 {
		return nil, 0, fmt.Errorf("field projection is not supported")
	}
	if len(body.Facets) > 0 {
		return nil, 0, fmt.Errorf("facets are not supported")
	}

	if err := applyWhere(req, body.Where); err != nil {
		return nil, 0, err
	}
	if err := applyLabelSelector(req, body.LabelSelector); err != nil {
		return nil, 0, err
	}
	if err := applySort(req, body.Sort); err != nil {
		return nil, 0, err
	}
	return req, offset, nil
}

// applyWhere flattens the where tree onto the request. v1 supports a top-level
// and-combinator plus text and filter leaves; a node may set exactly one of
// and/text/filter.
func applyWhere(req *resourcepb.ResourceSearchRequest, node *model.CreateSearchRulesRequestSearchWhereNode) error {
	if node == nil {
		return nil
	}
	set := 0
	if len(node.And) > 0 {
		set++
	}
	if node.Text != nil {
		set++
	}
	if node.Filter != nil {
		set++
	}
	if set > 1 {
		return fmt.Errorf("where node must set exactly one of and/text/filter")
	}

	for i := range node.And {
		if len(node.And[i].And) > 0 {
			return fmt.Errorf("nested and combinators are not supported")
		}
		if err := applyWhere(req, &node.And[i]); err != nil {
			return err
		}
	}
	if node.Text != nil {
		if err := applyText(req, node.Text); err != nil {
			return err
		}
	}
	if node.Filter != nil {
		if err := applyFilter(req, node.Filter); err != nil {
			return err
		}
	}
	return nil
}

// applyText sets the free-text query. Only one text leaf is supported; a second
// is rejected rather than silently overwriting the first. Per-field text search
// (the leaf's optional fields) is not yet wired to the backend and is rejected
// so a client is not misled into thinking it took effect.
func applyText(req *resourcepb.ResourceSearchRequest, leaf *model.CreateSearchRulesRequestSearchTextLeaf) error {
	if req.Query != "" {
		return fmt.Errorf("multiple text leaves are not supported")
	}
	if len(leaf.Fields) > 0 {
		return fmt.Errorf("per-field text search is not supported")
	}
	req.Query = leaf.Value
	return nil
}

// scalarFields are filterable fields the legacy backend applies as a single
// value (see extractFilters). A filter on one of these must carry exactly one
// value, else the extra values would be silently dropped.
var scalarFields = map[string]struct{}{
	fieldPaused:              {},
	fieldType:                {},
	fieldDashboardUID:        {},
	fieldPanelID:             {},
	fieldReceiver:            {},
	fieldNotificationType:    {},
	fieldRoutingTree:         {},
	fieldMetric:              {},
	fieldTargetDatasourceUID: {},
}

// validRuleTypes are the accepted values of a "type" filter.
var validRuleTypes = map[string]struct{}{
	"alertrule":     {},
	"recordingrule": {},
}

// applyFilter maps a filter leaf onto a field requirement. The labels field is
// special: its values are label matchers flattened into indexed terms. Values
// that the backend cannot honor are rejected rather than silently dropped.
func applyFilter(req *resourcepb.ResourceSearchRequest, leaf *model.CreateSearchRulesRequestSearchFilterLeaf) error {
	if _, ok := filterableFields[leaf.Field]; !ok {
		return fmt.Errorf("field %q is not filterable", leaf.Field)
	}
	if len(leaf.Values) == 0 {
		return fmt.Errorf("filter on %q requires at least one value", leaf.Field)
	}
	op, err := filterOperator(leaf.Operator)
	if err != nil {
		return err
	}
	if err := validateFilterLeaf(leaf); err != nil {
		return err
	}

	// The type filter selects the kind via kindSelection, which routes the query
	// to the matching per-kind backend. It is not a field requirement (the legacy
	// backend narrows by kind through its RuleType option), so do not append it.
	if leaf.Field == fieldType {
		return nil
	}

	if leaf.Field == fieldLabels {
		for _, v := range leaf.Values {
			// The In/NotIn operator carries negation, so a "!"-prefixed value
			// would double-negate. Reject it rather than resolve it ambiguously.
			if strings.HasPrefix(v, "!") {
				return fmt.Errorf("labels filter value %q must not be negated; use the NotIn operator instead", v)
			}
			m := parseLabelMatcher(v)
			if leaf.Operator == model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn {
				m = negateMatcher(m)
			}
			req.Options.Fields = append(req.Options.Fields, labelMatcherRequirement(m))
		}
		return nil
	}

	req.Options.Fields = append(req.Options.Fields, &resourcepb.Requirement{
		Key:      leaf.Field,
		Operator: op,
		Values:   leaf.Values,
	})
	return nil
}

// legacyUnsupportedFilterFields are declared in the kinds' searchFields (so the
// unified backend indexes and filters them) but the legacy backend's in-memory
// filter pass (extractFilters) has no matcher for them. Because a single handler
// serves both backends and the client cannot see the storage mode, filtering on
// these is rejected rather than honored on one backend and silently dropped on
// the other. Lifting a field out of this set requires adding its matcher to
// extractFilters/legacy_search first.
var legacyUnsupportedFilterFields = map[string]struct{}{
	fieldTitle:         {},
	fieldInterval:      {},
	fieldFor:           {},
	fieldKeepFiringFor: {},
	fieldAnnotations:   {},
}

// validateFilterLeaf rejects filter leaves the backend cannot faithfully apply,
// so a client learns its query was not honored instead of getting wrong results
// with a 200. Scalar fields must carry a single value; type must narrow to one
// valid kind via In; paused must be a boolean; NotIn is only honored on labels;
// and fields the legacy backend cannot filter are rejected outright.
func validateFilterLeaf(leaf *model.CreateSearchRulesRequestSearchFilterLeaf) error {
	if _, scalar := scalarFields[leaf.Field]; scalar && len(leaf.Values) != 1 {
		return fmt.Errorf("filter on %q accepts exactly one value", leaf.Field)
	}
	if _, unsupported := legacyUnsupportedFilterFields[leaf.Field]; unsupported {
		return fmt.Errorf("filtering on %q is not supported", leaf.Field)
	}
	// Only the labels field round-trips negation to the legacy backend
	// (requirementToLabelMatchers reads the operator). Every other field's
	// legacy matcher ignores the operator and would apply NotIn as an inclusive
	// match, returning the opposite of what was requested. Reject it.
	if leaf.Operator == model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn && leaf.Field != fieldLabels {
		return fmt.Errorf("the NotIn operator is not supported on %q", leaf.Field)
	}
	switch leaf.Field {
	case fieldType:
		// Kind narrowing is a single-kind selection (see kindSelection); NotIn
		// and multi-value would not round-trip to the legacy backend.
		if leaf.Operator != model.CreateSearchRulesRequestSearchFilterLeafOperatorIn {
			return fmt.Errorf("filter on %q supports only the In operator", fieldType)
		}
		if _, ok := validRuleTypes[leaf.Values[0]]; !ok {
			return fmt.Errorf("invalid %q value %q: must be alertrule or recordingrule", fieldType, leaf.Values[0])
		}
	case fieldPaused:
		if _, err := strconv.ParseBool(leaf.Values[0]); err != nil {
			return fmt.Errorf("invalid %q value %q: must be a boolean", fieldPaused, leaf.Values[0])
		}
	}
	return nil
}

func filterOperator(op model.CreateSearchRulesRequestSearchFilterLeafOperator) (string, error) {
	switch op {
	case model.CreateSearchRulesRequestSearchFilterLeafOperatorIn:
		return "in", nil
	case model.CreateSearchRulesRequestSearchFilterLeafOperatorNotIn:
		return "notin", nil
	default:
		return "", fmt.Errorf("unsupported filter operator %q", op)
	}
}

// applyLabelSelector parses a Kubernetes label selector and appends each
// requirement to the indexed labels field. Only equality/set membership is
// mapped; unsupported operators are rejected.
func applyLabelSelector(req *resourcepb.ResourceSearchRequest, selector *string) error {
	if selector == nil || *selector == "" {
		return nil
	}
	sel, err := labels.Parse(*selector)
	if err != nil {
		return fmt.Errorf("invalid labelSelector: %w", err)
	}
	reqs, _ := sel.Requirements()
	for _, r := range reqs {
		matchers, err := labelSelectorRequirementToMatchers(r)
		if err != nil {
			return err
		}
		for _, m := range matchers {
			req.Options.Fields = append(req.Options.Fields, labelMatcherRequirement(m))
		}
	}
	return nil
}

func labelSelectorRequirementToMatchers(r labels.Requirement) ([]labelMatcher, error) {
	key := r.Key()
	switch r.Operator() {
	case selection.Equals, selection.DoubleEquals:
		return []labelMatcher{{key: key, value: valueOf(r), op: matchEquals}}, nil
	case selection.NotEquals:
		return []labelMatcher{{key: key, value: valueOf(r), op: matchNotEquals}}, nil
	case selection.Exists:
		return []labelMatcher{{key: key, op: matchExists}}, nil
	case selection.DoesNotExist:
		return []labelMatcher{{key: key, op: matchNotExists}}, nil
	case selection.In:
		out := make([]labelMatcher, 0, r.Values().Len())
		for _, v := range r.Values().List() {
			out = append(out, labelMatcher{key: key, value: v, op: matchEquals})
		}
		return out, nil
	default:
		return nil, fmt.Errorf("unsupported label selector operator %q", r.Operator())
	}
}

func valueOf(r labels.Requirement) string {
	vals := r.Values().List()
	if len(vals) == 0 {
		return ""
	}
	return vals[0]
}

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

// applySort maps sort fields onto the request. A leading "-" denotes descending.
// Only the title field is sortable today; any other field is rejected.
func applySort(req *resourcepb.ResourceSearchRequest, fields []model.CreateSearchRulesRequestSearchSortField) error {
	for _, f := range fields {
		s := string(f)
		desc := strings.HasPrefix(s, "-")
		name := trimSortPrefix(s)
		if name != fieldTitle {
			return fmt.Errorf("field %q is not sortable", name)
		}
		req.SortBy = append(req.SortBy, &resourcepb.ResourceSearchRequest_Sort{Field: name, Desc: desc})
	}
	return nil
}

func trimSortPrefix(s string) string {
	if len(s) > 0 && s[0] == '-' {
		return s[1:]
	}
	return s
}

// filters is the backend-neutral view of a ResourceSearchRequest used by the
// legacy backend. The handler encodes these into the request; the legacy and
// unified backends each decode the request in their own way.
type filters struct {
	text                string
	names               []string
	folders             []string
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
			case fieldName:
				f.names = r.Values
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
	// title is the only sortable field the contract exposes today; any other
	// value falls through to the same stable title ordering.
	_ = field
	less := func(a, b *ngmodels.AlertRule) bool {
		if a.Title != b.Title {
			return a.Title < b.Title
		}
		return a.UID < b.UID
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
