package expressions

import (
	// TODO! we can flip the import order here... since we do not want have external imports
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr"
)

// QueryType = threshold
type ThresholdQueryTypeProperties struct {
	query.CommonQueryProperties `json:",inline"`

	Expression string                        `json:"expression"`
	Conditions []expr.ThresholdConditionJSON `json:"conditions"`
}
