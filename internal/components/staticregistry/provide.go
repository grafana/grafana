package staticregistry

import (
	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/coremodel/datasource"
	datasourcecrd "github.com/grafana/grafana/internal/coremodel/datasource/crd"
)

// ProvideRegistry provides a simple static Registry.
// Coremodels have to be manually added.
// TODO dynamism
func ProvideRegistry(
	datasource *datasource.Coremodel,
) (*components.Registry, error) {
	return components.NewCoremodelRegistry(
		datasource,
	)
}

// ProvideKubeControllerRegistry provides a simple static KubeControllerRegistry.
// KubeControllers must be manually added.
// TODO dynamism
func ProvideKubeControllerRegistry(
	datasourceModel *datasourcecrd.KubeController,
) (*components.KubeControllerRegistry, error) {
	return components.NewKubeControllerRegistry(
		datasourceModel,
	)
}
