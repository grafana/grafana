package v0alpha1

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
