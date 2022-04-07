package staticregistry

import (
	"github.com/grafana/grafana/internal/coremodel/datasource"
	"github.com/grafana/grafana/internal/framework/coremodel"
)

// ProvideRegistry provides a simple static Registry for coremodels.
// Coremodels have to be manually added.
// TODO dynamism
func ProvideRegistry(
	datasource *datasource.Coremodel,
) (*coremodel.Registry, error) {
	return coremodel.NewRegistry(
		datasource,
	)
}
