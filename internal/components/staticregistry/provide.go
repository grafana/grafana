package staticregistry

import (
	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/components/datasource"
)

// ProvideRegistry provides a simple static Registry.
// Coremodels have to be manually added to this Registry.
func ProvideRegistry(
	datasourceModel *datasource.Coremodel,
) (*components.Registry, error) {
	return components.NewRegistry(
		datasourceModel,
	)
}
