package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Similar to
// https://dev-k8sref-io.web.app/docs/common-definitions/objectreference-/
// ObjectReference contains enough information to let you inspect or modify the referred object.
type ObjectReference struct {
	// APIGroup is the name of the API group that contains the referred object.
	// The empty string represents the core API group.
	APIGroup string `json:"apiGroup,omitempty"`

	// APIVersion is the version of the API group that contains the referred object.
	APIVersion string `json:"apiVersion,omitempty"`

	// See https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#types-kinds
	Kind string `json:"kind,omitempty"`

	// Tenant isolation
	Namespace string `json:"namespace,omitempty"`

	// Explicit resource identifier
	Name string `json:"name,omitempty"`

	// May contain a valid JSON/Go field access statement
	FieldPath string `json:"fieldPath,omitempty"`

	// Sepcific deployment of an object
	UID types.UID `json:"uid,omitempty"`
}

func (r ObjectReference) ToOwnerReference() metav1.OwnerReference {
	return metav1.OwnerReference{
		APIVersion: fmt.Sprintf("%s/%s", r.APIGroup, r.APIVersion),
		Kind:       r.Kind,
		Name:       r.Name,
		UID:        r.UID,
	}
}
