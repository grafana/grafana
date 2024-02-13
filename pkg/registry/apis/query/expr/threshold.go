package expr

import (
	"github.com/grafana/grafana/pkg/expr"
)

type ThresholdQuery struct {
	// Reference to single query result
	Expression string `json:"expression" jsonschema:"minLength=1,example=$A"`

	// Threshold Conditions
	Conditions []expr.ThresholdConditionJSON `json:"conditions"`
}

func (*ThresholdQuery) ExpressionQueryType() QueryType {
	return QueryTypeThreshold
}

func (q *ThresholdQuery) Variables() []string {
	return []string{q.Expression}
}
