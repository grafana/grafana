package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Dataset struct {
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
	Info []FrameInfo `json:"info,omitempty"`

	// TODO: replace with a typed version (same by query results)
	// When large, this will be removed
	Data []DataFrame `json:"data,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DatasetList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Dataset `json:"items,omitempty"`
}

// FrameInfo describes
type FrameInfo struct {
	// The frame name (eg, worksheet)
	Name string `json:"uid"`

	// Array of fields (replace with full schema?)
	Fields []string `json:"fields"`

	// Title is the display value
	Rows int `json:"rows"`
}
