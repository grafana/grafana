package expressions

import (
	// TODO! we can flip the import order here... since we do not want have external imports
	"github.com/grafana/grafana/pkg/expr"
)

// QueryType = threshold
type ThresholdQueryTypeProperties struct {
	Expression string                        `json:"expression"`
	Conditions []expr.ThresholdConditionJSON `json:"conditions"`
}
