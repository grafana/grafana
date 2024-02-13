package expr

import (
	"github.com/grafana/grafana/pkg/expr/classic"
)

type ClassicQuery struct {
	Conditions []classic.ConditionJSON `json:"conditions"`
}

func (*ClassicQuery) ExpressionQueryType() QueryType {
	return QueryTypeClassic
}

func (q *ClassicQuery) Variables() []string {
	return []string{} // ??
}
