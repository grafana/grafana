// To change feature toggles, edit:
//  pkg/services/featuremgmt/registry.go
// Then run tests in:
//  pkg/services/featuremgmt/toggles_gen_test.go
// twice to generate and validate the feature toggle files

package registry

import (
	"bytes"
	"encoding/json"
	"sort"
	"strings"
)

var (
	Toggles = sortByName(append(
		unknownSquadToggles,
		multitenancySquadToggles...,
	))
)

func sortByName(toggles []FeatureToggle) []FeatureToggle {
	sort.Slice(toggles, func(i, j int) bool {
		return strings.Compare(toggles[i].Name, toggles[j].Name) < 0
	})
	return toggles
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
	case FeatureStateUnknown:
	}
	return "unknown"
}

// MarshalJSON marshals the enum as a quoted json string
func (s FeatureToggleState) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBufferString(`"`)
	buffer.WriteString(s.String())
	buffer.WriteString(`"`)
	return buffer.Bytes(), nil
}

// UnmarshalJSON unmarshals a quoted json string to the enum value
func (s *FeatureToggleState) UnmarshalJSON(b []byte) error {
	var j string
	err := json.Unmarshal(b, &j)
	if err != nil {
		return err
	}

	switch j {
	case "alpha":
		*s = FeatureStateAlpha

	case "beta":
		*s = FeatureStateBeta

	case "stable":
		*s = FeatureStateStable

	case "deprecated":
		*s = FeatureStateDeprecated

	default:
		*s = FeatureStateUnknown
	}
	return nil
}

type FeatureToggle struct {
	Name        string             `json:"name" yaml:"name"` // Unique name
	Description string             `json:"description"`
	State       FeatureToggleState `json:"state,omitempty"`
	DocsURL     string             `json:"docsURL,omitempty"`

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`

	// Special behavior flags
	RequiresDevMode bool `json:"requiresDevMode,omitempty"` // can not be enabled in production
	RequiresRestart bool `json:"requiresRestart,omitempty"` // The server must be initialized with the value
	RequiresLicense bool `json:"requiresLicense,omitempty"` // Must be enabled in the license
	FrontendOnly    bool `json:"frontend,omitempty"`        // change is only seen in the frontend
}
