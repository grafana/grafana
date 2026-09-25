package search

import (
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

const (
	perKindFilterOperatorIn    = "In"
	perKindFilterOperatorNotIn = "NotIn"

	sortAscending  = "asc"
	sortDescending = "desc"
)

var perKindValidRuleTypes = map[string]struct{}{
	ruleTypeAlerting:  {},
	ruleTypeRecording: {},
}

var perKindValidNotificationTypes = map[string]struct{}{
	string(ngmodels.NotificationSettingsTypeSimplifiedRouting): {},
	string(ngmodels.NotificationSettingsTypeNamedRoutingTree):  {},
}

func perKindRuleTypeNames() []string {
	return perKindSortedKeys(perKindValidRuleTypes)
}

func perKindNotificationTypeNames() []string {
	return perKindSortedKeys(perKindValidNotificationTypes)
}

func perKindSortedKeys(m map[string]struct{}) []string {
	names := make([]string, 0, len(m))
	for name := range m {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

var perKindDefaultReturnFields = []string{fieldTitle, fieldFolder}

func buildPerKindSearchRequest(q *searchv0.SearchQuery, leaves []searchv0.WhereNode, namespace string, k perKind) *Query {
	offset, _ := decodeCursor(q.Continue)
	fields := resolvePerKindReturnFields(q.Fields)
	req := &Query{
		Namespace: namespace,
		Primary:   k.groupResource(),
		Limit:     resolvePerKindLimit(q.Limit),
		Offset:    offset,
		Fields:    append([]string{}, fields...),
		PerKind:   true,
	}

	applyPerKindLeaves(req, leaves)
	applyPerKindLabelSelector(req, q.LabelSelector)
	applyPerKindSort(req, q.Sort)

	return req
}

func resolvePerKindLimit(limit int64) int64 {
	switch {
	case limit <= 0:
		return perKindDefaultLimit
	case limit > perKindMaxLimit:
		return perKindMaxLimit
	default:
		return limit
	}
}

func resolvePerKindReturnFields(fields []string) []string {
	if len(fields) == 0 {
		return perKindDefaultReturnFields
	}
	return fields
}

func applyPerKindLeaves(req *Query, leaves []searchv0.WhereNode) {
	for i := range leaves {
		switch n := leaves[i]; {
		case n.Text != nil:
			req.Text = n.Text.Value
		case n.Filter != nil:
			req.Filters = append(req.Filters, perKindFilterRequirement(n.Filter))
		}
	}
}

func perKindFilterRequirement(f *searchv0.FilterPredicate) *searchv0.FilterPredicate {
	if f.Field == fieldLabels {
		m := parseLabelMatcher(f.Values[0])
		if f.Operator == perKindFilterOperatorNotIn {
			m = negateMatcher(m)
		}
		return labelMatcherRequirement(m)
	}
	return f
}

func applyPerKindLabelSelector(req *Query, sel *metav1.LabelSelector) {
	if sel == nil {
		return
	}
	keys := make([]string, 0, len(sel.MatchLabels))
	for k := range sel.MatchLabels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		req.GroupFilters = append(req.GroupFilters, metav1.LabelSelectorRequirement{
			Key: k, Operator: metav1.LabelSelectorOpIn, Values: []string{sel.MatchLabels[k]},
		})
	}
	req.GroupFilters = append(req.GroupFilters, sel.MatchExpressions...)
}

func applyPerKindSort(req *Query, sorts []searchv0.SortField) {
	if len(sorts) == 0 {
		sorts = []searchv0.SortField{{Field: fieldTitle, Direction: sortAscending}}
	}
	req.Sort = sorts
}

func perKindSortRules(rules []*ngmodels.AlertRule, field string, desc bool) {
	_ = field
	sort.SliceStable(rules, func(i, j int) bool {
		aTitle := strings.ToLower(rules[i].Title)
		bTitle := strings.ToLower(rules[j].Title)
		if aTitle != bTitle {
			if desc {
				return aTitle > bTitle
			}
			return aTitle < bTitle
		}
		return rules[i].UID < rules[j].UID
	})
}
