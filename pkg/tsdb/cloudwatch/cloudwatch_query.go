package cloudwatch

import (
	"strings"
)

type cloudWatchQuery struct {
	RefId                   string
	Region                  string
	Id                      string
	Namespace               string
	MetricName              string
	Stats                   string
	Expression              string
	ReturnData              bool
	Dimensions              map[string][]string
	Period                  int
	Alias                   string
	MatchExact              bool
	UsedExpression          string
	RequestExceededMaxLimit bool
}

func (q *cloudWatchQuery) isMathExpression() bool {
	return q.Expression != "" && !q.isUserDefinedSearchExpression()
}

func (q *cloudWatchQuery) isSearchExpression() bool {
	return q.isUserDefinedSearchExpression() || q.isInferredSearchExpression()
}

func (q *cloudWatchQuery) isUserDefinedSearchExpression() bool {
	return strings.Contains(q.Expression, "SEARCH(")
}

func (q *cloudWatchQuery) isInferredSearchExpression() bool {
	if len(q.Dimensions) == 0 {
		return !q.MatchExact
	}

	if !q.MatchExact {
		return true
	}

	for _, values := range q.Dimensions {
		if len(values) > 1 {
			return true
		}
		for _, v := range values {
			if v == "*" {
				return true
			}
		}
	}
	return false
}

func (q *cloudWatchQuery) isMultiValuedDimensionExpression() bool {
	for _, values := range q.Dimensions {
		for _, v := range values {
			if v == "*" {
				return false
			}
		}

		if len(values) > 1 {
			return true
		}
	}

	return false
}

func (q *cloudWatchQuery) isMetricStat() bool {
	return !q.isSearchExpression() && !q.isMathExpression()
}
