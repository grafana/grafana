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

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Scope struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ScopeSpec `json:"spec,omitempty"`
}

type ScopeSpec struct {
	Title       string `json:"title"`
	Description string `json:"description"`

	// +listType=atomic
	Filters []ScopeFilter `json:"filters"`
}

type ScopeFilter struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	// Values is used for operators that require multiple values (e.g. one-of and not-one-of).
	Values   []string       `json:"values,omitempty"`
	Operator FilterOperator `json:"operator"`
}

// Type of the filter operator.
// +enum
type FilterOperator string

// Defines values for FilterOperator.
const (
	FilterOperatorEquals        FilterOperator = "equals"
	FilterOperatorNotEquals     FilterOperator = "not-equals"
	FilterOperatorRegexMatch    FilterOperator = "regex-match"
	FilterOperatorRegexNotMatch FilterOperator = "regex-not-match"
	FilterOperatorOneOf         FilterOperator = "one-of"
	FilterOperatorNotOneOf      FilterOperator = "not-one-of"
)
