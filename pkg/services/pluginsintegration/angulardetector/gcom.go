package angulardetector

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

	"github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

const (
	// gcomAngularPatternsPath is the relative path to the GCOM API handler that returns angular detection patterns.
	gcomAngularPatternsPath = "/api/plugins/angular_patterns"
)

var _ angulardetector.DetectorsProvider = &GCOMDetectorsProvider{}

// GCOMDetectorsProvider is a DetectorsProvider which fetches patterns from GCOM.
type GCOMDetectorsProvider struct {
	log log.Logger

	httpClient *http.Client

	baseURL string
}

// NewGCOMDetectorsProvider returns a new GCOMDetectorsProvider.
// baseURL is the GCOM base url, without /api and without a trailing slash (e.g.: https://grafana.com)
func NewGCOMDetectorsProvider(baseURL string) (angulardetector.DetectorsProvider, error) {
	cl, err := httpclient.New()
	if err != nil {
		return nil, fmt.Errorf("httpclient new: %w", err)
	}
	return &GCOMDetectorsProvider{
		log:        log.New("plugins.angulardetector.gcom"),
		baseURL:    baseURL,
		httpClient: cl,
	}, nil
}

// ProvideDetectors gets the dynamic angular detectors from the remote source.
// If an error occurs, the function fails silently by logging an error, and it returns nil.
func (p *GCOMDetectorsProvider) ProvideDetectors(ctx context.Context) []angulardetector.AngularDetector {
	patterns, err := p.fetch(ctx)
	if err != nil {
		p.log.Warn("Could not fetch remote angular patterns", "error", err)
		return nil
	}
	detectors, err := p.patternsToDetectors(patterns)
	if err != nil {
		p.log.Warn("Could not convert angular patterns to angularDetectors", "error", err)
		return nil
	}
	return detectors
}

// fetch fetches the angular patterns from GCOM and returns them as gcomPatterns.
// Call angularDetectors() on the returned value to get the corresponding angular detectors.
func (p *GCOMDetectorsProvider) fetch(ctx context.Context) (gcomPatterns, error) {
	st := time.Now()

	reqURL, err := url.JoinPath(p.baseURL, gcomAngularPatternsPath)
	if err != nil {
		return nil, fmt.Errorf("url joinpath: %w", err)
	}

	p.log.Debug("Fetching dynamic angular detection patterns", "url", reqURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("new request with context: %w", err)
	}
	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("http do: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			p.log.Error("response body close error", "error", err)
		}
	}()
	var out gcomPatterns
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, fmt.Errorf("json decode: %w", err)
	}
	p.log.Debug("Fetched dynamic angular detection patterns", "patterns", len(out), "duration", time.Since(st))
	return out, nil
}

// patternsToDetectors converts a slice of gcomPattern into a slice of angulardetector.AngularDetector, by calling
// angularDetector() on each gcomPattern.
func (p *GCOMDetectorsProvider) patternsToDetectors(patterns gcomPatterns) ([]angulardetector.AngularDetector, error) {
	var finalErr error
	detectors := make([]angulardetector.AngularDetector, 0, len(patterns))
	for _, pattern := range patterns {
		d, err := pattern.angularDetector()
		if err != nil {
			// Fail silently in case of an errUnknownPatternType.
			// This allows us to introduce new pattern types without breaking old Grafana versions
			if errors.Is(err, errUnknownPatternType) {
				p.log.Debug("Unknown angular pattern", "name", pattern.Name, "type", pattern.Type, "error", err)
				continue
			}
			// Other error, do not ignore it
			finalErr = errors.Join(finalErr, err)
		}
		detectors = append(detectors, d)
	}
	if finalErr != nil {
		return nil, finalErr
	}
	return detectors, nil
}

// gcomPatternType is a pattern type returned by the GCOM API.
type gcomPatternType string

const (
	gcomPatternTypeContains gcomPatternType = "contains"
	gcomPatternTypeRegex    gcomPatternType = "regex"
)

// errUnknownPatternType is returned when a pattern type is not known.
var errUnknownPatternType = errors.New("unknown pattern type")

// gcomPattern is an Angular detection pattern returned by the GCOM API.
type gcomPattern struct {
	Name    string
	Pattern string
	Type    gcomPatternType
}

// angularDetector converts a gcomPattern into an AngularDetector, based on its Type.
// If a pattern type is unknown, it returns an error wrapping errUnknownPatternType.
func (p *gcomPattern) angularDetector() (angulardetector.AngularDetector, error) {
	switch p.Type {
	case gcomPatternTypeContains:
		return &angulardetector.ContainsBytesDetector{Pattern: []byte(p.Pattern)}, nil
	case gcomPatternTypeRegex:
		re, err := regexp.Compile(p.Pattern)
		if err != nil {
			return nil, fmt.Errorf("%q regexp compile: %w", p.Pattern, err)
		}
		return &angulardetector.RegexDetector{Regex: re}, nil
	}
	return nil, fmt.Errorf("%q: %w", p.Type, errUnknownPatternType)
}

// gcomPatterns is a slice of gcomPattern s.
type gcomPatterns []gcomPattern
