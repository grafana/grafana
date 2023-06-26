package angulardetectorsprovider

import (
	"errors"
	"fmt"
	"regexp"

	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

// gcomAngularPatternsPath is the relative path to the GCOM API handler that returns angular detection patterns.
const gcomAngularPatternsPath = "/api/plugins/angular_patterns"

// GCOMPatternType is a pattern type returned by the GCOM API.
type GCOMPatternType string

const (
	GCOMPatternTypeContains GCOMPatternType = "contains"
	GCOMPatternTypeRegex    GCOMPatternType = "regex"
)

// GCOMPattern is an Angular detection pattern returned by the GCOM API.
type GCOMPattern struct {
	Name    string
	Pattern string
	Type    GCOMPatternType
}

// errUnknownPatternType is returned when a pattern type is not known.
var errUnknownPatternType = errors.New("unknown pattern type")

// Detector converts a gcomPattern into a Detector, based on its Type.
// If a pattern type is unknown, it returns an error wrapping errUnknownPatternType.
func (p *GCOMPattern) detector() (angulardetector.AngularDetector, error) {
	switch p.Type {
	case GCOMPatternTypeContains:
		return &angulardetector.ContainsBytesDetector{Pattern: []byte(p.Pattern)}, nil
	case GCOMPatternTypeRegex:
		re, err := regexp.Compile(p.Pattern)
		if err != nil {
			return nil, fmt.Errorf("%q regexp compile: %w", p.Pattern, err)
		}
		return &angulardetector.RegexDetector{Regex: re}, nil
	}
	return nil, fmt.Errorf("%q: %w", p.Type, errUnknownPatternType)
}

// GCOMPatterns is a slice of GCOMPattern
type GCOMPatterns []GCOMPattern

// Detectors converts the slice of GCOMPattern into a slice of angulardetector.AngularDetector, by calling Detector() on each GCOMPattern.
func (p GCOMPatterns) Detectors() ([]angulardetector.AngularDetector, error) {
	var finalErr error
	detectors := make([]angulardetector.AngularDetector, 0, len(p))
	for _, pattern := range p {
		d, err := pattern.detector()
		if err != nil {
			// Fail silently in case of an errUnknownPatternType.
			// This allows us to introduce new pattern types without breaking old Grafana versions
			if !errors.Is(err, errUnknownPatternType) {
				// Other error, do not ignore it
				finalErr = errors.Join(finalErr, err)
			}
			continue
		}
		detectors = append(detectors, d)
	}
	if finalErr != nil {
		return nil, finalErr
	}
	return detectors, nil
}
