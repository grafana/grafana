package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AppDeploymentInfo struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The dashboard body
	Spec Info `json:"spec,omitempty"`
}

type Info struct {
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
	APIs []string `json:"apis,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type AppDeploymentInfoList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []AppDeploymentInfo `json:"items,omitempty"`
}
