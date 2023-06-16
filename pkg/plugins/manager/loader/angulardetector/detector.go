package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ detector = &containsBytesDetector{}
	_ detector = &regexDetector{}

	_ detectorsProvider = &staticDetectorsProvider{}
	_ detectorsProvider = sequenceDetectorsProvider{}
)

// detector implements a check to see if a js file is using angular APIs.
type detector interface {
	// detect takes the content of a js file and returns true if the plugin is using Angular.
	detect(js []byte) bool
}

// containsBytesDetector is a detector that returns true if module.js contains the "pattern" string.
type containsBytesDetector struct {
	pattern []byte
}

// detect returns true if moduleJs contains the byte slice d.pattern.
func (d *containsBytesDetector) detect(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.pattern)
}

// regexDetector is a detector that returns true if the module.js content matches a regular expression.
type regexDetector struct {
	regex *regexp.Regexp
}

// Detect returns true if moduleJs matches the regular expression d.regex.
func (d *regexDetector) detect(moduleJs []byte) bool {
	return d.regex.Match(moduleJs)
}

// detectorsProvider can provide multiple detectors used for Angular detection.
type detectorsProvider interface {
	// provideDetectors returns a slice of detectors.
	provideDetectors(ctx context.Context) []detector
}

// staticDetectorsProvider is a detectorsProvider that always returns a pre-defined slice of detectors.
type staticDetectorsProvider struct {
	detectors []detector
}

func (p *staticDetectorsProvider) provideDetectors(_ context.Context) []detector {
	return p.detectors
}

// sequenceDetectorsProvider is a detectorsProvider that wraps a slice of other detectorsProvider, and returns the first
// provided result that isn't empty.
type sequenceDetectorsProvider []detectorsProvider

func (p sequenceDetectorsProvider) provideDetectors(ctx context.Context) []detector {
	for _, provider := range p {
		if detectors := provider.provideDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}
