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

// detector implements a check to see if a plugin uses Angular.
type detector interface {
	// Detect takes the content of a moduleJs file and returns true if the plugin is using Angular.
	Detect(moduleJs []byte) bool
}

// containsBytesDetector is a detector that returns true if module.js contains the "pattern" string.
type containsBytesDetector struct {
	pattern []byte
}

// Detect returns true if moduleJs contains the byte slice d.pattern.
func (d *containsBytesDetector) Detect(moduleJs []byte) bool {
	return bytes.Contains(moduleJs, d.pattern)
}

// regexDetector is a detector that returns true if the module.js content matches a regular expression.
type regexDetector struct {
	regex *regexp.Regexp
}

// Detect returns true if moduleJs matches the regular expression d.regex.
func (d *regexDetector) Detect(moduleJs []byte) bool {
	return d.regex.Match(moduleJs)
}

// detectorsProvider returns a slice of detectors.
type detectorsProvider interface {
	provideDetectors(ctx context.Context) []detector
}

// staticDetectorsProvider is a detectorsProvider that always returns the provided detectors.
type staticDetectorsProvider struct {
	detectors []detector
}

func (p *staticDetectorsProvider) provideDetectors(_ context.Context) []detector {
	return p.detectors
}

// sequenceDetectorsProvider is a detectorsProvider that wraps a slice of detectorsProvider and returns the first
// provider result that isn't empty.
type sequenceDetectorsProvider []detectorsProvider

func (p sequenceDetectorsProvider) provideDetectors(ctx context.Context) []detector {
	for _, provider := range p {
		if detectors := provider.provideDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}
