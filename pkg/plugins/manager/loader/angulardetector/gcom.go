package angulardetector

import (
	"errors"
	"fmt"
	"regexp"
)

type GCOMPatternType string

const (
	GCOMPatternTypeContains GCOMPatternType = "contains"
	GCOMPatternTypeRegex    GCOMPatternType = "regex"
)

// GCOMPattern is an Angular detection pattern returned by the GCOM API.
type GCOMPattern struct {
	Name  string
	Value string
	Type  GCOMPatternType
}

// detector converts a GCOMPattern into a detector, based on its Type.
func (p *GCOMPattern) detector() (detector, error) {
	switch p.Type {
	case GCOMPatternTypeContains:
		return &containsBytesDetector{pattern: []byte(p.Value)}, nil
	case GCOMPatternTypeRegex:
		re, err := regexp.Compile(p.Value)
		if err != nil {
			return nil, fmt.Errorf("%q regexp compile: %w", p.Value, err)
		}
		return &regexDetector{regex: re}, nil
	}
	return nil, errors.New("unknown pattern type")
}

// GCOMPatterns is a slice of GCOMPattern s.
type GCOMPatterns []GCOMPattern

// detectors converts the slice of GCOMPattern s into a slice of detectors, by calling detector() on each GCOMPattern.
func (p GCOMPatterns) detectors() ([]detector, error) {
	var finalErr error
	detectors := make([]detector, 0, len(p))
	for _, pattern := range p {
		d, err := pattern.detector()
		if err != nil {
			finalErr = errors.Join(finalErr, err)
			continue
		}
		detectors = append(detectors, d)
	}
	if finalErr != nil {
		return nil, finalErr
	}
	return detectors, nil
}
