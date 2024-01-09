package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	runtime "k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apis"
)

const (
	GROUP      = "frontend.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ExtensionResourceInfo = apis.NewResourceInfo(GROUP, VERSION,
	"extension", "extensions", "ExtensionResource",
	func() runtime.Object { return &ExtensionResource{} },
	func() runtime.Object { return &ExtensionResourceList{} },
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExtensionResource struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ExtensionInfo `json:"spec"`
}

// Frontend extensions/plugins/assets (name TBD)
type ExtensionInfo struct {
	// Plugin display name
	Title string `json:"title,omitempty"`

	// Plugin description
	Description string `json:"description,omitempty"`

	// Version
	Version string `json:"version,omitempty"`

	// URL to base assets
	Assets string `json:"assets,omitempty"`

	// Path to the plugin icon
	Icon string `json:"icon,omitempty"`

	// The javascript entrypoint
	Module string `json:"module,omitempty"`

	// List of required APIs
	APIs []metav1.GroupVersion `json:"apis,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExtensionResourceList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []ExtensionResource `json:"items,omitempty"`
}
