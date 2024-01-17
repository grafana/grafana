package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Folder struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// TODO, structure so the name is not in spec
	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Describe the feature toggle
	Title string `json:"title"`

	// Describe the feature toggle
	Description string `json:"description,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Folder `json:"items,omitempty"`
}

// FolderInfo returns a list of folder indentifiers (parents or children)
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderInfo struct {
	metav1.TypeMeta `json:",inline"`

	Items []FolderItem `json:"items"`
}

type FolderItem struct {
	Name  string `json:"name"`
	Title string `json:"title"`
}
