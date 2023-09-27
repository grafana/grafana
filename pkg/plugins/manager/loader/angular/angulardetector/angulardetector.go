package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ AngularDetector = &ContainsBytesDetector{}
	_ AngularDetector = &RegexDetector{}

	_ DetectorsProvider = &StaticDetectorsProvider{}
	_ DetectorsProvider = SequenceDetectorsProvider{}
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

// SequenceDetectorsProvider is a DetectorsProvider that wraps a slice of other DetectorsProvider, and returns the first
// provided result that isn't empty.
type SequenceDetectorsProvider []DetectorsProvider

func (p SequenceDetectorsProvider) ProvideDetectors(ctx context.Context) []AngularDetector {
	for _, provider := range p {
		if detectors := provider.ProvideDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}
