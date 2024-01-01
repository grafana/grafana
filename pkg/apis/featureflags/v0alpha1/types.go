package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis"
)

const (
	GROUP      = "featureflags.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var FeatureResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"features", "feature", "Feature",
	func() runtime.Object { return &Feature{} },
	func() runtime.Object { return &FeatureList{} },
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Feature struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec FeatureSpec `json:"spec,omitempty"`
}

type FeatureSpec struct {
	// The feature description
	Description string `json:"description"`

	// Indicates the features level of stability
	Stage string `json:"stage"`

	// The team who owns this feature development
	Owner string `json:"codeowner,omitempty"`

	AllowSelfServe    bool `json:"allowSelfServe,omitempty"`
	HideFromAdminPage bool `json:"hideFromAdminPage,omitempty"`

	RequiresDevMode bool `json:"requiresDevMode,omitempty"`
	RequiresLicense bool `json:"requiresLicense,omitempty"`
	FrontendOnly    bool `json:"frontend,omitempty"`
	HideFromDocs    bool `json:"hideFromDocs,omitempty"`
	RequiresRestart bool `json:"requiresRestart,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Feature `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureToggle struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The configured flags.  Note this may include unknown fields
	Spec map[string]bool `json:"spec,omitempty"`
}

type ToggleStatus struct {
	UnknownToggles []string
}

type FlagInfo struct {
	// Name of the feature
	Feature string
	Enabled bool   // only false if explicitly set to false
	Source  string // startup | tenant|org | user | browser

	//
	Warning string
}
