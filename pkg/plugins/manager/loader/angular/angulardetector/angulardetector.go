package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ Detector = &ContainsBytesDetector{}
	_ Detector = &RegexDetector{}

	_ DetectorsProvider = &StaticDetectorsProvider{}
	_ DetectorsProvider = SequenceDetectorsProvider{}
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

// SequenceDetectorsProvider is a DetectorsProvider that wraps a slice of other DetectorsProvider, and returns the first
// provided result that isn't empty.
type SequenceDetectorsProvider []DetectorsProvider

func (p SequenceDetectorsProvider) ProvideDetectors(ctx context.Context) []Detector {
	for _, provider := range p {
		if detectors := provider.ProvideDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}
