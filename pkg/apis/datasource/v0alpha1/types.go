package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen=true
// +k8s:openapi-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type HealthCheckResult struct {
	metav1.TypeMeta `json:",inline"`

	// The string description
	Status string `json:"status,omitempty"`

	// Explicit status code
	Code int `json:"code,omitempty"`

	// Optional description for the data source
	Message string `json:"message,omitempty"`

	// Spec depends on the plugin
	Details *common.Unstructured `json:"details,omitempty"`
}
