package expressions

import (
	// TODO!!!
	// Once this feels a bit more stable, we should flip the import order here...
	// We want to exclude external imports if possible
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/expr/classic"
)

// QueryType = classic
type ClassicQueryTypeProperties struct {
	query.CommonQueryProperties `json:",inline"`

	Conditions []classic.ConditionJSON `json:"conditions"`
}
