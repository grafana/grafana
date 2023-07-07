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

var (
	// errUnknownPatternType is returned when a pattern type is not known.
	errUnknownPatternType = errors.New("unknown pattern type")

	// errInvalidRegex is returned when a regex pattern has an invalid regex.
	errInvalidRegex = errors.New("invalid regex")
)

// angularDetector converts a gcomPattern into a Detector, based on its Type.
// If a pattern type is unknown, it returns an error wrapping errUnknownPatternType.
func (p *GCOMPattern) angularDetector() (angulardetector.AngularDetector, error) {
	switch p.Type {
	case GCOMPatternTypeContains:
		return &angulardetector.ContainsBytesDetector{Pattern: []byte(p.Pattern)}, nil
	case GCOMPatternTypeRegex:
		re, err := regexp.Compile(p.Pattern)
		if err != nil {
			return nil, fmt.Errorf("%q regexp compile: %w: %s", p.Pattern, errInvalidRegex, err)
		}
		return &angulardetector.RegexDetector{Regex: re}, nil
	}
	return nil, fmt.Errorf("%q: %w", p.Type, errUnknownPatternType)
}

// GCOMPatterns is a slice of GCOMPattern
type GCOMPatterns []GCOMPattern
