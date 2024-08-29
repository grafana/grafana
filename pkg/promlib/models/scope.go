package models

import (
	"fmt"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

func ApplyFiltersAndGroupBy(rawExpr string, scopeFilters, adHocFilters []ScopeFilter, groupBy []string) (string, error) {
	expr, err := parser.ParseExpr(rawExpr)
	if err != nil {
		return "", err
	}

	matchers, err := filtersToMatchers(scopeFilters, adHocFilters)
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

func filtersToMatchers(scopeFilters, adhocFilters []ScopeFilter) ([]*labels.Matcher, error) {
	filterMap := make(map[string]*labels.Matcher)

	changedToRegex := make(map[string]bool)
	for _, filter := range append(scopeFilters, adhocFilters...) {
		matcher, err := filterToMatcher(filter)
		if err != nil {
			return nil, err
		}

		// if filter already exists and the existing one is equal operator, change existing filter to regex operator
		// and append the value with or ("|"), else override the existing filter
		if existing, ok := filterMap[filter.Key]; ok {
			if filter.Operator == FilterOperatorEquals && (existing.Type == labels.MatchEqual || changedToRegex[filter.Key]) {
				existing.Type = labels.MatchRegexp
				changedToRegex[filter.Key] = true
				existing.Value = existing.Value + "|" + matcher.Value
				continue
			}
		}
		// In the case of != , do we want to override or combine?
		// Might that depend on if it is Ad-Hoc+ScopeFilters vs all the filters
		// coming form the same source?
		// In this case, it depends if the user wants to refine the results with
		// additional conditions, or override. Perhaps directly using the regex
		// filter operator should be a way to override, else it refines?
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
	default:
		return nil, fmt.Errorf("unknown operator %q", f.Operator)
	}
	return labels.NewMatcher(mt, f.Key, f.Value)
}
