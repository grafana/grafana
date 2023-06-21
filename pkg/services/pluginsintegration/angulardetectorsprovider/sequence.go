package angulardetectorsprovider

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// SequenceDetectorsProvider is a DetectorsProvider that wraps a slice of other DetectorsProvider, and returns the first
// provided result that isn't empty.
type SequenceDetectorsProvider []angulardetector.DetectorsProvider

func (p SequenceDetectorsProvider) ProvideDetectors(ctx context.Context) []angulardetector.Detector {
	for _, provider := range p {
		if detectors := provider.ProvideDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}

// newDynamicWithStaticFallbackDetectorsProvider returns a new angulardetector.DetectorsProvider that will try to get
// the detectors from the "dynamic" detectors provider first, and if it fails, it will fall back to the "static"
// detectors provider.
func newDynamicWithStaticFallbackDetectorsProvider(dynamic *Dynamic, static *Static) angulardetector.DetectorsProvider {
	return SequenceDetectorsProvider{dynamic, static}
}

// ProvideDetectorsProvider provides the implementation of angulardetector.DetectorsProvider depending on the feature
// flags.
func ProvideDetectorsProvider(features featuremgmt.FeatureToggles, dynamic *Dynamic, static *Static) angulardetector.DetectorsProvider {
	if features.IsEnabled(featuremgmt.FlagPluginsDynamicAngularDetectionPatterns) {
		return newDynamicWithStaticFallbackDetectorsProvider(dynamic, static)
	}
	return static
}
