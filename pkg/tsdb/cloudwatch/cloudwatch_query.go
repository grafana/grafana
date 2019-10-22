package cloudwatch

import (
	"strings"
)

type CloudWatchQuery struct {
	RefId              string
	Region             string
	Id                 string
	Namespace          string
	MetricName         string
	Statistics         []*string
	QueryType          string
	Expression         string
	ReturnData         bool
	Dimensions         map[string][]string
	ExtendedStatistics []*string
	Period             int
	Alias              string
	Identifier         string
	HighResolution     bool
	SearchExpressions  []string
}

func (e *CloudWatchQuery) isMathExpression() bool {
	return len(e.Statistics) == 1 && e.Expression != "" && !strings.Contains(e.Expression, "SEARCH(")
}

func (e *CloudWatchQuery) isUserDefinedSearchExpression() bool {
	return len(e.Statistics) == 1 && strings.Contains(e.Expression, "SEARCH(")
}

func (e *CloudWatchQuery) isInferredSearchExpression() bool {
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

func (e *CloudWatchQuery) isSearchExpression() bool {
	return e.isUserDefinedSearchExpression() || e.isInferredSearchExpression()
}
