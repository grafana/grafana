package featuremgmt

import (
	"bytes"
	"encoding/json"
)

type FeatureToggles interface {
	IsEnabled(flag string) bool
}

// FeatureFlagStage indicates the quality level
type FeatureFlagStage int

const (
	// FeatureStageUnknown indicates that no state is specified
	FeatureStageUnknown FeatureFlagStage = iota

	// FeatureStageExperimental -- Does this work for Grafana Labs?
	FeatureStageExperimental

	// FeatureStagePrivatePreview -- Does this work for a limited number of customers?
	FeatureStagePrivatePreview

	// FeatureStagePublicPreview -- Does this work for most customers?
	FeatureStagePublicPreview

	// FeatureStageGeneralAvailability -- Feature is available to all applicable customers
	FeatureStageGeneralAvailability

	// FeatureStageDeprecated the feature will be removed in the future
	FeatureStageDeprecated
)

func (s FeatureFlagStage) String() string {
	switch s {
	case FeatureStageExperimental:
		return "experimental"
	case FeatureStagePrivatePreview:
		return "privatePreview"
	case FeatureStagePublicPreview:
		return "preview"
	case FeatureStageGeneralAvailability:
		return "GA"
	case FeatureStageDeprecated:
		return "deprecated"
	case FeatureStageUnknown:
	}
	return "unknown"
}

// MarshalJSON marshals the enum as a quoted json string
func (s FeatureFlagStage) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBufferString(`"`)
	buffer.WriteString(s.String())
	buffer.WriteString(`"`)
	return buffer.Bytes(), nil
}

// UnmarshalJSON unmarshals a quoted json string to the enum value
func (s *FeatureFlagStage) UnmarshalJSON(b []byte) error {
	var j string
	err := json.Unmarshal(b, &j)
	if err != nil {
		return err
	}

	switch j {
	case "alpha":
		fallthrough
	case "experimental":
		*s = FeatureStageExperimental

	case "privatePreview":
		*s = FeatureStagePrivatePreview

	case "beta":
		fallthrough
	case "preview":
		*s = FeatureStagePublicPreview

	case "stable":
		fallthrough
	case "ga":
		fallthrough
	case "GA":
		*s = FeatureStageGeneralAvailability

	case "deprecated":
		*s = FeatureStageDeprecated

	default:
		*s = FeatureStageUnknown
	}
	return nil
}

type FeatureFlag struct {
	Name        string           `json:"name" yaml:"name"` // Unique name
	Description string           `json:"description"`
	Stage       FeatureFlagStage `json:"stage,omitempty"`
	DocsURL     string           `json:"docsURL,omitempty"`

	// Owner person or team that owns this feature flag
	Owner codeowner `json:"-"`

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`

	// Special behavior flags
	RequiresDevMode bool `json:"requiresDevMode,omitempty"` // can not be enabled in production
	RequiresRestart bool `json:"requiresRestart,omitempty"` // The server must be initialized with the value
	RequiresLicense bool `json:"requiresLicense,omitempty"` // Must be enabled in the license
	FrontendOnly    bool `json:"frontend,omitempty"`        // change is only seen in the frontend
	HideFromDocs    bool `json:"hideFromDocs,omitempty"`    // don't add the values to docs
}
