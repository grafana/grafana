package expressions

import (
	// TODO! we can flip the import order here... since we do not want have external imports
	"github.com/grafana/grafana/pkg/expr/classic"
)

// QueryType = classic
type ClassicQueryTypeProperties struct {
	Conditions []classic.ConditionJSON `json:"conditions"`
}
