package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type File struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Human readable description for this dataset
	Title string `json:"title"`

	// Description
	Description string `json:"description,omitempty"`

	// Frame info
	Info []FileInfo `json:"info,omitempty"`

	// TODO: replace with a typed version (same by query results)
	// When large, this will be removed
	Data []FileData `json:"data,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FileList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []File `json:"items,omitempty"`
}

// FrameInfo describes
type FileInfo struct {
	// The frame name (eg, worksheet)
	Name string `json:"uid"`

	Type string `json:"type"`
}
