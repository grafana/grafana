package cloudwatch

import (
	"strings"
)

type cloudWatchQuery struct {
	RefId                   string
	Region                  string
	Id                      string
	UserDefinedId           string
	Namespace               string
	MetricName              string
	Stats                   string
	QueryType               string
	Expression              string
	ReturnData              bool
	Dimensions              map[string][]string
	Period                  int
	Alias                   string
	Identifier              string
	HighResolution          bool
	MatchExact              bool
	SearchExpression        string
	RequestExceededMaxLimit bool
}

func (e *cloudWatchQuery) isMathExpression() bool {
	return e.Expression != "" && !strings.Contains(e.Expression, "SEARCH(")
}

func (e *cloudWatchQuery) isSearchExpression() bool {
	if strings.Contains(e.Expression, "SEARCH(") {
		return true
	}

	for _, values := range e.Dimensions {
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

func (e *cloudWatchQuery) isMetricStat() bool {
	return !e.isSearchExpression() && !e.isMathExpression()
}
