package staticregistry

import (
	"github.com/grafana/grafana/pkg/coremodel/dashboard"
	"github.com/grafana/grafana/pkg/framework/coremodel"
)

// ProvideRegistry provides a simple static Registry for coremodels.
// Coremodels have to be manually added.
// TODO dynamism
func ProvideRegistry(
	dashboard *dashboard.Coremodel,
) (*coremodel.Registry, error) {
	cmlist := []coremodel.Interface{
		dashboard,
	}

	return coremodel.NewRegistry(cmlist...)
}
