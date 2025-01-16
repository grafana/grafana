package models

import (
	"fmt"
	"strings"

	"github.com/prometheus/common/model"
	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

func init() {
	model.NameValidationScheme = model.UTF8Validation
}

// ApplyFiltersAndGroupBy takes a raw promQL expression, converts the filters into PromQL matchers, and applies these matchers to the parsed expression. It also applies the group by clause to any aggregate expressions in the parsed expression.
func ApplyFiltersAndGroupBy(rawExpr string, scopeFilters, adHocFilters []ScopeFilter, groupBy []string) (string, error) {
	expr, err := parser.ParseExpr(rawExpr)
	if err != nil {
		return "", err
	}

	matchers, err := FiltersToMatchers(scopeFilters, adHocFilters)
	if err != nil {
		return "", err
	}

	matcherNamesToIdx := make(map[string]int, len(matchers))
	for i, matcher := range matchers {
		if matcher == nil {
			continue
		}
		matcherNamesToIdx[matcher.Name] = i
	}

	parser.Inspect(expr, func(node parser.Node, nodes []parser.Node) error {
		switch v := node.(type) {
		case *parser.VectorSelector:
			found := make([]bool, len(matchers))
			for _, matcher := range v.LabelMatchers {
				if matcher == nil || matcher.Name == "__name__" { // const prob
					continue
				}
				if _, ok := matcherNamesToIdx[matcher.Name]; ok {
					found[matcherNamesToIdx[matcher.Name]] = true
					newM := matchers[matcherNamesToIdx[matcher.Name]]
					matcher.Name = newM.Name
					matcher.Type = newM.Type
					matcher.Value = newM.Value
				}
			}
			for i, f := range found {
				if f {
					continue
				}
				v.LabelMatchers = append(v.LabelMatchers, matchers[i])
			}

			return nil
		case *parser.AggregateExpr:
			found := make(map[string]bool)
			for _, lName := range v.Grouping {
				found[lName] = true
			}
			for _, k := range groupBy {
				if !found[k] {
					v.Grouping = append(v.Grouping, k)
				}
			}
			return nil
		default:
			return nil
		}
	})
	return expr.String(), nil
}

func FiltersToMatchers(scopeFilters, adhocFilters []ScopeFilter) ([]*labels.Matcher, error) {
	filterMap := make(map[string]*labels.Matcher)

	// scope filters are applied first
	for _, filter := range scopeFilters {
		matcher, err := filterToMatcher(filter)
		if err != nil {
			return nil, err
		}

		// when scopes have the same key, both values should be matched
		// in prometheus that means using an regex with both values
		if _, ok := filterMap[filter.Key]; ok {
			filterMap[filter.Key].Value = filterMap[filter.Key].Value + "|" + matcher.Value
			filterMap[filter.Key].Type = labels.MatchRegexp
		} else {
			filterMap[filter.Key] = matcher
		}
	}

	// ad hoc filters are applied after scope filters
	for _, filter := range adhocFilters {
		matcher, err := filterToMatcher(filter)
		if err != nil {
			return nil, err
		}

		// when ad hoc filters have the same key, the last one should be used
		filterMap[filter.Key] = matcher
	}

	matchers := make([]*labels.Matcher, 0, len(filterMap))
	for _, matcher := range filterMap {
		matchers = append(matchers, matcher)
	}

	return matchers, nil
}

func filterToMatcher(f ScopeFilter) (*labels.Matcher, error) {
	var mt labels.MatchType
	switch f.Operator {
	case FilterOperatorEquals:
		mt = labels.MatchEqual
	case FilterOperatorNotEquals:
		mt = labels.MatchNotEqual
	case FilterOperatorRegexMatch:
		mt = labels.MatchRegexp
	case FilterOperatorRegexNotMatch:
		mt = labels.MatchNotRegexp
	case FilterOperatorOneOf:
		mt = labels.MatchRegexp
	case FilterOperatorNotOneOf:
		mt = labels.MatchNotRegexp
	default:
		return nil, fmt.Errorf("unknown operator %q", f.Operator)
	}
	if f.Operator == FilterOperatorOneOf || f.Operator == FilterOperatorNotOneOf {
		if len(f.Values) > 0 {
			return labels.NewMatcher(mt, f.Key, strings.Join(f.Values, "|"))
		}
	}
	return labels.NewMatcher(mt, f.Key, f.Value)
}
