package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Collection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec CollectionSpec `json:"spec,omitempty"`
}

type CollectionSpec struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Kind        string   `json:"kind"` // dashboard?  or allow a mix
	Tags        []string `json:"tags"`

	// +listType=atomic
	Items []string `json:"items"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type CollectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Collection `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Stars struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec StarsSpec `json:"spec,omitempty"`
}

type StarsSpec struct {
	// List of dashboard names
	Dashboards []string `json:"dashboards"`

	// Query history from explore
	QueryHistory []string `json:"queryHistory"`
}

// StarsList is not used directly by users because it is tied to a single user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type StarsList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Stars `json:"items,omitempty"`
}
