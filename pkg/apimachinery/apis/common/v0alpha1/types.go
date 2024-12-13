package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Similar to
// https://dev-k8sref-io.web.app/docs/common-definitions/objectreference-/
// ObjectReference contains enough information to let you inspect or modify the referred object.
type ObjectReference struct {
	Resource  string `json:"resource,omitempty"`
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name,omitempty"`

	// APIGroup is the name of the API group that contains the referred object.
	// The empty string represents the core API group.
	APIGroup string `json:"apiGroup,omitempty"`

	// APIVersion is the version of the API group that contains the referred object.
	APIVersion string `json:"apiVersion,omitempty"`
}

// Note: this is currently defined in dashboards, as we only
// register the subresource to dashboards. But restore is implemented
// generically in unistore, so if we start to use this on new resources,
// this should be instead defined in a common package.
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type RestoreOptions struct {
	metav1.TypeMeta `json:",inline"`
	ResourceVersion int64 `json:"resourceVersion"`
}
