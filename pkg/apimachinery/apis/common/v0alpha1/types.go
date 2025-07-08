package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Similar to metav1.OwenerReference, but it includes the namespace
type ResourceReference struct {
	Group     string    `json:"group,omitempty"`
	Version   string    `json:"version,omitempty"`
	Kind      string    `json:"kind,omitempty"`      // or resource?
	Namespace string    `json:"namespace,omitempty"` // This does not exist in metav1.OwnerReference
	Name      string    `json:"name,omitempty"`
	UID       types.UID `json:"uid,omitempty"`
}

// Similar to
// https://dev-k8sref-io.web.app/docs/common-definitions/objectreference-/
// ObjectReference contains enough information to let you inspect or modify the referred object.
// Deprecated: this should be removed
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
