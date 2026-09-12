package search

import (
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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

type perKindTranslated struct {
	req    *resourcepb.ResourceSearchRequest
	offset int64
	fields []string
}

func translatePerKindQuery(q *searchv0.SearchQuery, leaves []searchv0.WhereNode, namespace string, k perKind) perKindTranslated {
	offset, _ := decodeCursor(q.Continue)
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(namespace, k.groupResource())},
		Limit:   resolvePerKindLimit(q.Limit),
		Offset:  offset,
		Fields:  append([]string{}, resultColumns...),
	}

	applyPerKindLeaves(req, leaves)
	applyPerKindLabelSelector(req, q.LabelSelector)
	applyPerKindSort(req, q.Sort)

	return perKindTranslated{req: req, offset: offset, fields: resolvePerKindReturnFields(q.Fields)}
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

func applyPerKindLeaves(req *resourcepb.ResourceSearchRequest, leaves []searchv0.WhereNode) {
	for i := range leaves {
		switch n := leaves[i]; {
		case n.Text != nil:
			req.Query = n.Text.Value
		case n.Filter != nil:
			req.Options.Fields = append(req.Options.Fields, perKindFilterRequirement(n.Filter))
		}
	}
}

func perKindFilterRequirement(f *searchv0.FilterPredicate) *resourcepb.Requirement {
	if f.Field == fieldLabels {
		m := parseLabelMatcher(f.Values[0])
		if f.Operator == perKindFilterOperatorNotIn {
			m = negateMatcher(m)
		}
		return labelMatcherRequirement(m)
	}
	return &resourcepb.Requirement{Key: f.Field, Operator: perKindFilterOperator(f.Operator), Values: f.Values}
}

func perKindFilterOperator(op string) string {
	if op == perKindFilterOperatorNotIn {
		return "notin"
	}
	return "in"
}

func applyPerKindLabelSelector(req *resourcepb.ResourceSearchRequest, sel *metav1.LabelSelector) {
	if sel == nil {
		return
	}
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

func applyPerKindSort(req *resourcepb.ResourceSearchRequest, sorts []searchv0.SortField) {
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
