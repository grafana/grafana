package staticregistry

import (
	"github.com/grafana/grafana/internal/components"
	"github.com/grafana/grafana/internal/components/datasource"
	datasourcecrd "github.com/grafana/grafana/internal/components/datasource/crd"
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

// ProvideKubeModelRegistry provides a simple static KubeModelRegistry.
// KubeModels must be manually added.
// TODO dynamism
func ProvideKubeModelRegistry(
	datasourceModel *datasourcecrd.KubeModel,
) (*components.KubeModelRegistry, error) {
	return components.NewKubeModelRegistry(
		datasourceModel,
	)
}
