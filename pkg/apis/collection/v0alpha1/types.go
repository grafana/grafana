package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserStars struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec CollectionSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type UserStarsList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []UserStars `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Collection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec CollectionSpec `json:"spec,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type CollectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []UserStars `json:"items,omitempty"`
}

// <group>/<resource>
type ResourceRefString = string

type ResourceNames = []string

type CollectionSpec struct {
	// A display name
	Title string `json:"title,omitempty"`

	// Longer description for why it is interesting
	Description string `json:"description,omitempty"`

	// The group/resource+names for stared items
	Values map[ResourceRefString]ResourceNames `json:"values"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ModifyCollection struct {
	metav1.TypeMeta `json:",inline"`

	// Add resource to the collection
	Add []ResourceRefString `json:"add,omitempty"`

	// Remove resource from the collection
	Remove []ResourceRefString `json:"remove,omitempty"`
}
