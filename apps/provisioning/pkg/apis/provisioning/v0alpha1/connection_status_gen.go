// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

// +k8s:openapi-gen=true
type ConnectionStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`
	// FieldErrors are errors that occurred during validation of the connection spec.
	// These errors are intended to help users identify and fix issues in the spec.
	// +listType=atomic
	FieldErrors []ErrorDetails `json:"fieldErrors,omitempty"`
	// Conditions represent the latest available observations of the connection's state.
	// +listType=map
	// +listMapKey=type
	// +patchMergeKey=type
	// +patchStrategy=merge
	Conditions []metav1.Condition `json:"conditions,omitempty" patchStrategy:"merge" patchMergeKey:"type"`
	// The connection health status
	Health HealthStatus `json:"health"`
	// Token holds metadata about the last generated connection token, used to avoid
	// regenerating a token whose secret was written recently but is not yet readable.
	Token TokenStatus `json:"token,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionStatus.
func (ConnectionStatus) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionStatus"
}
