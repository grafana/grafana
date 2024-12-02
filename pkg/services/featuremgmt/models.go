package featuremgmt

import (
	"bytes"
	"context"
	"encoding/json"
)

type FeatureToggles interface {
	// IsEnabled checks if a feature is enabled for a given context.
	// The settings may be per user, tenant, or globally set in the cloud
	IsEnabled(ctx context.Context, flag string) bool

	// IsEnabledGlobally checks if a flag is configured globally.  For now, this is the same
	// as the function above, however it will move to only checking flags that
	// are configured by the operator and shared across all tenants.
	// Use of global feature flags should be limited and careful as they require
	// a full server restart for a change to take place.
	IsEnabledGlobally(flag string) bool

	// Get the enabled flags -- this *may* also include disabled flags (with value false)
	// but it is guaranteed to have the enabled ones listed
	GetEnabled(ctx context.Context) map[string]bool
}

func AnyEnabled(f FeatureToggles, flags ...string) bool {
	for _, flag := range flags {
		if f.IsEnabledGlobally(flag) {
			return true
		}
	}
	return false
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

// These are properties about the feature, but not the current state or value for it
type FeatureFlag struct {
	Name        string           `json:"name" yaml:"name"` // Unique name
	Description string           `json:"description"`
	Stage       FeatureFlagStage `json:"stage,omitempty"`
	Owner       codeowner        `json:"-"` // Owner person or team that owns this feature flag

	// Recommended properties - control behavior of the feature toggle management page in the UI
	AllowSelfServe    bool `json:"allowSelfServe,omitempty"`    // allow users with the right privileges to toggle this from the UI (GeneralAvailability, PublicPreview, and Deprecated toggles only)
	HideFromAdminPage bool `json:"hideFromAdminPage,omitempty"` // GA, Deprecated, and PublicPreview toggles only: don't display this feature in the UI; if this is a GA toggle, add a comment with the reasoning

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`

	// Special behavior properties
	RequiresDevMode bool `json:"requiresDevMode,omitempty"` // can not be enabled in production
	FrontendOnly    bool `json:"frontend,omitempty"`        // change is only seen in the frontend
	HideFromDocs    bool `json:"hideFromDocs,omitempty"`    // don't add the values to docs

	// The server must be initialized with the value
	RequiresRestart bool `json:"requiresRestart,omitempty"`
}

type FeatureToggleWebhookPayload struct {
	FeatureToggles map[string]string `json:"feature_toggles"`
	User           string            `json:"user"`
}
