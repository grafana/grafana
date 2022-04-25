package staticregistry

import (
	"github.com/grafana/grafana/pkg/coremodel/dashboard"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ProvideRegistry provides a simple static Registry for coremodels.
// Coremodels have to be manually added.
// TODO dynamism
func ProvideRegistry(
	feat featuremgmt.FeatureManager,
	dashboard *dashboard.Coremodel,
) (*coremodel.Registry, error) {
	cmlist := []coremodel.Interface{
		dashboard,
	}

	// return coremodel.NewRegistry(cmlist...)
	// Uncomment above line and everything delete below, as well as unfeatured.go,
	// once coremodels are no longer feature flagged
	var newfunc registryProvider
	newfunc = coremodel.NewRegistry
	if feat.IsEnabled(featuremgmt.FlagCoremodelValidation) {
		newfunc = provideStub
	}

	return newfunc(cmlist...)
}
