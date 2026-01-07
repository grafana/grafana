package featuremgmt

import (
	"bytes"
	"context"
	"encoding/json"
)

//go:generate mockery --name FeatureToggles --structname MockFeatureToggles --inpackage --filename feature_toggles_mock.go --with-expecter
type FeatureToggles interface {
	// IsEnabled checks if a feature is enabled for a given context.
	// The settings may be per user, tenant, or globally set in the cloud
	//
	// Deprecated: FeatureToggles.IsEnabled is deprecated and will be removed in a future release.
	// Evaluate with OpenFeature instead (see [github.com/open-feature/go-sdk/openfeature.Client]), for example:
	// openfeature.NewDefaultClient().Boolean(ctx, "your-flag", false, openfeature.TransactionContext(ctx))
	IsEnabled(ctx context.Context, flag string) bool

	// IsEnabledGlobally checks if a flag is configured globally.  For now, this is the same
	// as the function above, however it will move to only checking flags that
	// are configured by the operator and shared across all tenants.
	// Use of global feature flags should be limited and careful as they require
	// a full server restart for a change to take place.
	//
	// Deprecated: FeatureToggles.IsEnabledGlobally is deprecated and will be removed in a future release.
	// Toggles that must be reliably evaluated at the service startup should be changed to settings and/or removed entirely.
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

type FeatureFlagType int

const (
	// Boolean -- Type of a flag
	Boolean FeatureFlagType = iota
	Integer
	Float
	String
	Structure
)

func (t FeatureFlagType) String() string {
	switch t {
	case Boolean:
		return "boolean"
	case Integer:
		return "integer"
	case Float:
		return "float"
	case String:
		return "string"
	case Structure:
		return "structure"
	}

	return "unknown"
}

// MarshalJSON marshals the enum as a quoted json string
func (t FeatureFlagType) MarshalJSON() ([]byte, error) {
	buffer := bytes.NewBufferString(`"`)
	buffer.WriteString(t.String())
	buffer.WriteString(`"`)
	return buffer.Bytes(), nil
}

func (t *FeatureFlagType) UnmarshalJSON(b []byte) error {
	var j string
	err := json.Unmarshal(b, &j)
	if err != nil {
		return err
	}

	switch j {
	case "boolean":
		*t = Boolean
	case "integer":
		*t = Integer
	case "float":
		*t = Float
	case "string":
		*t = String
	case "structure":
		*t = Structure
	}
	return nil
}

// These are properties about the feature, but not the current state or value for it
type FeatureFlag struct {
	Name        string           `json:"name" yaml:"name"` // Unique name
	Description string           `json:"description"`
	Stage       FeatureFlagStage `json:"stage,omitempty"`
	Owner       codeowner        `json:"-"` // Owner person or team that owns this feature flag

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`
	// Type of the feature flag (boolean, number, string, structure),
	Type FeatureFlagType `json:"type,omitempty"`

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
