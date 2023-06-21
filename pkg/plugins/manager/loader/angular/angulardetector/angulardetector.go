package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ AngularDetector = &ContainsBytesDetector{}
	_ AngularDetector = &RegexDetector{}
)

// AngularDetector implements a check to see if a js file is using angular APIs.
type AngularDetector interface {
	// DetectAngular takes the content of a js file and returns true if the plugin is using Angular.
	DetectAngular(js []byte) bool
}

// ContainsBytesDetector is an AngularDetector that returns true if module.js contains the "pattern" string.
type ContainsBytesDetector struct {
	Pattern []byte
}

// DetectAngular returns true if moduleJs contains the byte slice d.pattern.
func (d *ContainsBytesDetector) DetectAngular(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.Pattern)
}

// RegexDetector is an AngularDetector that returns true if the module.js content matches a regular expression.
type RegexDetector struct {
	Regex *regexp.Regexp
}

// DetectAngular returns true if moduleJs matches the regular expression d.regex.
func (d *RegexDetector) DetectAngular(moduleJs []byte) bool {
	return d.Regex.Match(moduleJs)
}

// DetectorsProvider can provide multiple AngularDetectors used for Angular detection.
type DetectorsProvider interface {
	// ProvideDetectors returns a slice of AngularDetector.
	ProvideDetectors(ctx context.Context) []AngularDetector
}

// StaticDetectorsProvider is a DetectorsProvider that always returns a pre-defined slice of AngularDetector.
type StaticDetectorsProvider struct {
	Detectors []AngularDetector
}

func (p *StaticDetectorsProvider) ProvideDetectors(_ context.Context) []AngularDetector {
	return p.Detectors
}

// defaultDetectors contains all the detectors to Detect Angular plugins.
// They are executed in the specified order.
var defaultDetectors = []AngularDetector{
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
