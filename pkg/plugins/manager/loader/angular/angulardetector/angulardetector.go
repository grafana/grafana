package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ Detector = &ContainsBytesDetector{}
	_ Detector = &RegexDetector{}
)

// Detector implements a check to see if a js file is using angular APIs.
type Detector interface {
	// Detect takes the content of a js file and returns true if the plugin is using Angular.
	Detect(js []byte) bool
}

// ContainsBytesDetector is a Detector that returns true if module.js contains the "pattern" string.
type ContainsBytesDetector struct {
	Pattern []byte
}

// Detect returns true if moduleJs contains the byte slice d.pattern.
func (d *ContainsBytesDetector) Detect(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.Pattern)
}

// RegexDetector is a Detector that returns true if the module.js content matches a regular expression.
type RegexDetector struct {
	Regex *regexp.Regexp
}

// Detect returns true if moduleJs matches the regular expression d.regex.
func (d *RegexDetector) Detect(moduleJs []byte) bool {
	return d.Regex.Match(moduleJs)
}

// DetectorsProvider can provide multiple detectors used for Angular detection.
type DetectorsProvider interface {
	// ProvideDetectors returns a slice of detectors.
	ProvideDetectors(ctx context.Context) []Detector
}

// StaticDetectorsProvider is a DetectorsProvider that always returns a pre-defined slice of detectors.
type StaticDetectorsProvider struct {
	Detectors []Detector
}

func (p *StaticDetectorsProvider) ProvideDetectors(_ context.Context) []Detector {
	return p.Detectors
}

// defaultDetectors contains all the detectors to Detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []Detector{
	&ContainsBytesDetector{Pattern: []byte("PanelCtrl")},
	&ContainsBytesDetector{Pattern: []byte("QueryCtrl")},
	&ContainsBytesDetector{Pattern: []byte("app/plugins/sdk")},
	&ContainsBytesDetector{Pattern: []byte("angular.isNumber(")},
	&ContainsBytesDetector{Pattern: []byte("editor.html")},
	&ContainsBytesDetector{Pattern: []byte("ctrl.annotation")},
	&ContainsBytesDetector{Pattern: []byte("getLegacyAngularInjector")},

	&RegexDetector{Regex: regexp.MustCompile(`['"](app/core/utils/promiseToDigest)|(app/plugins/.*?)|(app/core/core_module)['"]`)},
	&RegexDetector{Regex: regexp.MustCompile(`from\s+['"]grafana\/app\/`)},
	&RegexDetector{Regex: regexp.MustCompile(`System\.register\(`)},
}

// NewDefaultStaticDetectorsProvider returns a new StaticDetectorsProvider with the default (static, hardcoded) angular
// detection patterns (defaultDetectors)
func NewDefaultStaticDetectorsProvider() DetectorsProvider {
	return &StaticDetectorsProvider{Detectors: defaultDetectors}
}
