package staticregistry

import (
	datasource "github.com/grafana/grafana/internal/coremodel/datasource/crd"
	"github.com/grafana/grafana/internal/framework/kubecontroller"
)

// ProvideRegistry provides a simple static Registry for KubeControllers.
// KubeControllers must be manually added.
// TODO dynamism
func ProvideRegistry(
	datasourceModel *datasource.KubeController,
) (*kubecontroller.Registry, error) {
	return kubecontroller.NewRegistry(
		datasourceModel,
	)
}
