package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureFlag struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// TODO, structure so the name is not in spec
	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Describe the feature toggle
	Description string `json:"description"`

	// How far along in development is this
	Stage featuremgmt.FeatureFlagStage `json:"stage,omitempty"`

	// Additional documentation
	DocsURL string `json:"docsURL,omitempty"`

	// Owner person or team that owns this feature flag
	Owner string `json:"-"`

	// CEL-GO expression.  Using the value "true" will mean this is on by default
	Expression string `json:"expression,omitempty"`

	// Special behavior flags
	RequiresDevMode bool `json:"requiresDevMode,omitempty"` // can not be enabled in production
	// This flag is currently unused.
	RequiresRestart   bool  `json:"requiresRestart,omitempty"`   // The server must be initialized with the value
	RequiresLicense   bool  `json:"requiresLicense,omitempty"`   // Must be enabled in the license
	FrontendOnly      bool  `json:"frontend,omitempty"`          // change is only seen in the frontend
	HideFromDocs      bool  `json:"hideFromDocs,omitempty"`      // don't add the values to docs
	HideFromAdminPage bool  `json:"hideFromAdminPage,omitempty"` // don't display the feature in the admin page - add a comment with the reasoning
	AllowSelfServe    *bool `json:"allowSelfServe,omitempty"`    // allow admin users to toggle the feature state from the admin page; this is required for GA toggles only
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureFlagList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []FeatureFlag `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FlagConfig struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Configure which values are set (or unset)
	Spec map[string]bool `json:"spec"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FlagConfigList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []FlagConfig `json:"items,omitempty"`
}

// The set of flags that apply for your environment
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ConfiguredFlags struct {
	metav1.TypeMeta `json:",inline"`

	// Configure which values are set (or unset)
	Flags []string `json:"flags"`
}
