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

var FeatureFlagResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"features", "feature", "FeatureFlag",
	func() runtime.Object { return &FeatureFlag{} },
	func() runtime.Object { return &FeatureFlagList{} },
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureFlag struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
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
type FeatureFlagList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []FeatureFlag `json:"items,omitempty"`
}
