package v0alpha1

import (
	"time"

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
	// Properties from featuremgmt.FeatureFlag
	Description string    `json:"description"`
	Stage       string    `json:"stage,omitempty"`
	Created     time.Time `json:"created,omitempty"`
	Owner       string    `json:"codeowner,omitempty"`

	AllowSelfServe    bool `json:"allowSelfServe"`
	HideFromAdminPage bool `json:"hideFromAdminPage"`

	RequiresDevMode bool `json:"requiresDevMode"`
	RequiresLicense bool `json:"requiresLicense"`
	FrontendOnly    bool `json:"frontend"`
	HideFromDocs    bool `json:"hideFromDocs"`

	Enabled bool `json:"enabled"`

	RequiresRestart bool `json:"requiresRestart"`

	// Properties from featuremgmt.FeatureToggleDTO
	ReadOnly bool `json:"readOnly"`
	Hidden   bool `json:"hidden"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FeatureFlagList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []FeatureFlag `json:"items,omitempty"`
}
