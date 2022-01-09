package featuremgmt

type FeatureManager interface {
	IsEnabled(flag string) bool
	GetEnabled() map[string]bool
	GetFlags() []FeatureFlag
	GetFeatureToggles() FeatureToggles
}

type FeatureToggleState string

const (
	AlphaState   FeatureToggleState = "alpha"   // anything can change without warning
	BetaState    FeatureToggleState = "beta"    // shape looks right, but still evoloving
	StableState  FeatureToggleState = "stable"  // stable and may soon become a build-in feature
	MergedState  FeatureToggleState = "merged"  // feature no longer requires an explicit flag
	RemovedState FeatureToggleState = "removed" // the feature was not merged and no longer has any effect
)

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
