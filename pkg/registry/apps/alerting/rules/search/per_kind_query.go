package search

import (
	"sort"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	searchv0 "github.com/grafana/grafana/pkg/apis/search/v0alpha1"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
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

type perKindSearchRequest struct {
	req    *resourcepb.ResourceSearchRequest
	offset int64
	fields []string
}

func buildPerKindSearchRequest(q *searchv0.SearchQuery, leaves []searchv0.WhereNode, namespace string, k perKind) perKindSearchRequest {
	offset, _ := decodeCursor(q.Continue)
	fields := resolvePerKindReturnFields(q.Fields)
	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: resourceKey(namespace, k.groupResource())},
		Limit:   resolvePerKindLimit(q.Limit),
		Offset:  offset,
		Fields:  append([]string{}, fields...),
	}

	applyPerKindLeaves(req, leaves, k)
	applyPerKindLabelSelector(req, q.LabelSelector)
	applyPerKindSort(req, q.Sort)

	return perKindSearchRequest{req: req, offset: offset, fields: fields}
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

func applyPerKindLeaves(req *resourcepb.ResourceSearchRequest, leaves []searchv0.WhereNode, k perKind) {
	for i := range leaves {
		switch n := leaves[i]; {
		case n.Text != nil:
			req.Query = n.Text.Value
		case n.Filter != nil:
			req.Options.Fields = append(req.Options.Fields, perKindFilterRequirement(n.Filter, k))
		case n.Regex != nil:
			req.Options.Fields = append(req.Options.Fields, perKindRegexRequirement(n.Regex, k))
		}
	}
}

func perKindFilterRequirement(f *searchv0.FilterPredicate, k perKind) *resourcepb.Requirement {
	resolved, _, _ := k.fields.resolvePredicateField(f.Field)
	if resolved.name == fieldLabels && resolved.mapKey == "" {
		m := parseLabelMatcher(f.Values[0])
		if f.Operator == perKindFilterOperatorNotIn {
			m = negateMatcher(m)
		}
		return labelMatcherRequirement(m)
	}
	if resolved.mapKey != "" {
		values := make([]string, len(f.Values))
		for i, value := range f.Values {
			values[i] = resolved.mapKey + "=" + value
		}
		return &resourcepb.Requirement{Key: resolved.name, Operator: perKindFilterOperator(f.Operator), Values: values}
	}
	return &resourcepb.Requirement{Key: f.Field, Operator: perKindFilterOperator(f.Operator), Values: f.Values}
}

func perKindRegexRequirement(r *searchv0.RegexPredicate, k perKind) *resourcepb.Requirement {
	resolved, _, _ := k.fields.resolvePredicateField(r.Field)
	op := string(resource.OperatorRegex)
	if r.Negate {
		op = string(resource.OperatorNotRegex)
	}
	return &resourcepb.Requirement{Key: resolved.name, Operator: op, Values: []string{resolved.mapKey + "=" + r.Pattern}}
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
