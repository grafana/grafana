package angulardetector

import (
	"bytes"
	"context"
	"regexp"
)

var (
	_ detector = &containsBytesDetector{}
	_ detector = &regexDetector{}
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

// detectorsGetter returns a list of angular detector s.
type detectorsGetter interface {
	// getDetectors returns a slice of detector provided by the detectorsGetter.
	getDetectors(ctx context.Context) []detector
}

// staticDetectorsGetter is a detectorsGetter that always returns the provided detectors.
type staticDetectorsGetter struct {
	detectors []detector
}

func (g *staticDetectorsGetter) getDetectors(_ context.Context) []detector {
	return g.detectors
}

// sequenceDetectorsGetter is a detectorsGetter that calls all the detectorsGetters in it and returns the
// first value which isn't empty.
type sequenceDetectorsGetter []detectorsGetter

func (d sequenceDetectorsGetter) getDetectors(ctx context.Context) []detector {
	for _, getter := range d {
		if detectors := getter.getDetectors(ctx); len(detectors) > 0 {
			return detectors
		}
	}
	return nil
}
