package setting

import (
	"bytes"
	"encoding/json"
	"fmt"
	"reflect"
)

type FeatureToggles interface {
	IsEnabled(flag string) bool

	GetEnabled() []string
}

// FeatureToggleState indicates the quality level
type FeatureToggleState int

const (
	// FeatureStateUnknown indicates that no state is specified
	FeatureStateUnknown FeatureToggleState = iota

	// FeatureStateAlpha the feature is in active development and may change at any time
	FeatureStateAlpha

	// FeatureStateBeta the feature is still in development, but settings will have migrations
	FeatureStateBeta

	// FeatureStateStable this is a stable feature
	FeatureStateStable

	// FeatureStateDeprecated the feature will be removed in the future
	FeatureStateDeprecated
)

func (s FeatureToggleState) String() string {
	switch s {
	case FeatureStateAlpha:
		return "alpha"
	case FeatureStateBeta:
		return "beta"
	case FeatureStateStable:
		return "stable"
	case FeatureStateDeprecated:
		return "deprecated"
	}
	return "unknown"
}

// MarshalJSON marshals the enum as a quoted json string
func (p FeatureToggleState) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBufferString(`"`)
	buffer.WriteString(p.String())
	buffer.WriteString(`"`)
	return buffer.Bytes(), nil
}

// UnmarshalJSON unmarshals a quoted json string to the enum value
func (p *FeatureToggleState) UnmarshalJSON(b []byte) error {
	var j string
	err := json.Unmarshal(b, &j)
	if err != nil {
		return err
	}

	switch j {
	case "alpha":
		*p = FeatureStateAlpha

	case "beta":
		*p = FeatureStateBeta

	case "stable":
		*p = FeatureStateStable

	case "deprecated":
		*p = FeatureStateDeprecated

	default:
		*p = FeatureStateUnknown

	}
	return nil
}

type FeatureFlag struct {
	Name        string             `json:"name"` // Unique name
	Description string             `json:"description"`
	State       FeatureToggleState `json:"state,omitempty"`
	DocsURL     string             `json:"docsURL,omitempty"`

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`

	// Special behavior flags
	RequiresDevMode bool `json:"requiresDevMode,omitempty"` // can not be enabled in production
	RequiresRestart bool `json:"requiresRestart,omitempty"` // The server must be initalized with the value
	FrontendOnly    bool `json:"frontend,omitempty"`        // change is only seen in the frontend
}

type featureToggles struct {
	loookup map[string]bool
}

func (ft *featureToggles) IsEnabled(flag string) bool {
	return ft.loookup[flag]
}

func (ft *featureToggles) GetEnabled() []string {
	enabled := make([]string, 0, len(ft.loookup))
	for key, val := range ft.loookup {
		if val {
			enabled = append(enabled, key)
		}
	}
	return enabled
}

// WithFeatures is used to define feature toggles for testing.
// The arguments are a list of strings that are optionally followed by a boolean value
func WithFeatures(spec ...interface{}) FeatureToggleInfo {
	count := len(spec)
	lookup := make(map[string]bool, count)

	idx := 0
	for idx < count {
		key := fmt.Sprintf("%v", spec[idx])
		val := true
		idx++
		if idx < count && reflect.TypeOf(spec[idx]).Kind() == reflect.Bool {
			val = spec[idx].(bool)
			idx++
		}

		if val {
			lookup[key] = true
		}
	}

	return NewFeatureToggleInfo(&featureToggles{loookup: lookup})
}
