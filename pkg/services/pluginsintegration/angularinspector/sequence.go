package angularinspector

import (
	"context"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
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
