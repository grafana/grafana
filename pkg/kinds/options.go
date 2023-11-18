package kinds

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

// Represents an options object that must be named for each namespace/team/user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type NamespacedOptions[T runtime.Object] struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Show the options inline
	Spec T `json:"spec"`
}

// Represents a list of namespaced options
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type NamespacedOptionsList[T runtime.Object] struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []NamespacedOptions[T] `json:"items,omitempty"`
}
