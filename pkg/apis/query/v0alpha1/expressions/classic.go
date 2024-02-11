package expressions

import (
	// TODO!!!
	// Once this feels a bit more stable, we should flip the import order here...
	// We want to exclude external imports if possible
	"github.com/grafana/grafana/pkg/expr/classic"
)

// QueryType = classic
type ClassicQueryTypeProperties struct {
	Conditions []classic.ConditionJSON `json:"conditions"`
}
