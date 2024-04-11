package models

import (
	"fmt"

	"github.com/prometheus/prometheus/model/labels"
	"github.com/prometheus/prometheus/promql/parser"
)

func ApplyQueryFilters(rawExpr string, scopeFilters, adHocFilters []ScopeFilter) (string, error) {
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

		default:
			return nil
		}
	})
	return expr.String(), nil
}

func filtersToMatchers(scopeFilters, adhocFilters []ScopeFilter) ([]*labels.Matcher, error) {
	filterMap := make(map[string]*labels.Matcher)

	for _, filter := range append(scopeFilters, adhocFilters...) {
		matcher, err := filterToMatcher(filter)
		if err != nil {
			return nil, err
		}
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
