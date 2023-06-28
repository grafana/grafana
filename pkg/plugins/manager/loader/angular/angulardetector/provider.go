package angulardetector

import (
	"regexp"
)

// DetectorsProvider can provide multiple AngularDetectors used for Angular detection.
type DetectorsProvider interface {
	// ProvideDetectors returns a slice of AngularDetector.
	ProvideDetectors() []AngularDetector
}

// StaticDetectorsProvider is a DetectorsProvider that always returns a pre-defined slice of AngularDetector.
type StaticDetectorsProvider struct {
	Detectors []AngularDetector
}

func (p *StaticDetectorsProvider) ProvideDetectors() []AngularDetector {
	return p.Detectors
}

// SequenceDetectorsProvider is a DetectorsProvider that wraps a slice of other DetectorsProvider, and returns the first
// provided result that isn't empty.
type SequenceDetectorsProvider []DetectorsProvider

func (p SequenceDetectorsProvider) ProvideDetectors() []AngularDetector {
	for _, provider := range p {
		if detectors := provider.ProvideDetectors(); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}

// defaultDetectors contains all the detectors to Detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []AngularDetector{
	&ContainsBytesDetector{Pattern: []byte("PanelCtrl")},
	&ContainsBytesDetector{Pattern: []byte("ConfigCtrl")},
	&ContainsBytesDetector{Pattern: []byte("app/plugins/sdk")},
	&ContainsBytesDetector{Pattern: []byte("angular.isNumber(")},
	&ContainsBytesDetector{Pattern: []byte("editor.html")},
	&ContainsBytesDetector{Pattern: []byte("ctrl.annotation")},
	&ContainsBytesDetector{Pattern: []byte("getLegacyAngularInjector")},

	&RegexDetector{Regex: regexp.MustCompile(`["']QueryCtrl["']`)},
}

// NewDefaultStaticDetectorsProvider returns a new StaticDetectorsProvider with the default (static, hardcoded) angular
// detection patterns (defaultDetectors)
func NewDefaultStaticDetectorsProvider() DetectorsProvider {
	return &StaticDetectorsProvider{Detectors: defaultDetectors}
}
