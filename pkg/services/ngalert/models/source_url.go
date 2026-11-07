package models

import (
	"fmt"
	"net/url"
)

// MaxSourceURLLength is the maximum length of a provisioned alert rule source URL.
const MaxSourceURLLength = 2048

// ValidateSourceURL accepts an empty value, which clears a stored URL, or an absolute
// http or https URL with a host and no userinfo.
func ValidateSourceURL(raw string) error {
	if raw == "" {
		return nil
	}
	if len(raw) > MaxSourceURLLength {
		return fmt.Errorf("sourceUrl must be at most %d characters", MaxSourceURLLength)
	}
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" || parsed.User != nil {
		return fmt.Errorf("sourceUrl must be an http or https URL with a host and no userinfo")
	}
	return nil
}

// NewSourceURLPointer validates raw and returns the write-intent pointer stored on AlertRule.
// An empty raw clears a stored URL. A non-empty URL is rejected when the rule is not provisioned.
func NewSourceURLPointer(raw string, provenance Provenance) (*string, error) {
	if err := ValidateSourceURL(raw); err != nil {
		return nil, fmt.Errorf("%w: %s", ErrAlertRuleFailedValidation, err.Error())
	}
	if raw != "" && provenance == ProvenanceNone {
		return nil, fmt.Errorf("%w: sourceUrl requires a provisioned rule", ErrAlertRuleFailedValidation)
	}
	value := raw
	return &value, nil
}

// SourceURLFromAnnotation maps grafana.app/sourcePath onto the write-intent pointer.
// An empty path is not a write. A path whose scheme is not http or https is not a
// write either, because that annotation is also a repository file path. An http or
// https value is validated, including the requirement that the rule is provisioned.
func SourceURLFromAnnotation(path string, provenance Provenance) (*string, error) {
	if path == "" {
		return nil, nil
	}
	parsed, err := url.Parse(path)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, nil
	}
	return NewSourceURLPointer(path, provenance)
}
