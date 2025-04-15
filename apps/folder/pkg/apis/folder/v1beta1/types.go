package v1beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

// FolderInfoList returns a list of folder references (parents or children)
// Unlike FolderList, each item is not a full k8s object
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderInfoList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=map
	// +listMapKey=uid
	Items []FolderInfo `json:"items,omitempty"`
}

// FolderInfo briefly describes a folder -- unlike a folder resource,
// this is a partial record of the folder metadata used for navigating parents and children
type FolderInfo struct {
	// Name is the k8s name (eg, the unique identifier) for a folder
	Name string `json:"name"`

	// Title is the display value
	Title string `json:"title"`

	// The folder description
	Description string `json:"description,omitempty"`

	// The parent folder UID
	Parent string `json:"parent,omitempty"`

	// This folder does not resolve
	Detached bool `json:"detached,omitempty"`
}

// Access control information for the current user
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderAccessInfo struct {
	metav1.TypeMeta `json:",inline"`

	CanSave   bool `json:"canSave"`
	CanEdit   bool `json:"canEdit"`
	CanAdmin  bool `json:"canAdmin"`
	CanDelete bool `json:"canDelete"`
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DescendantCounts struct {
	metav1.TypeMeta `json:",inline"`

	Counts []ResourceStats `json:"counts"`
}

type ResourceStats struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

func UnstructuredToDescendantCounts(obj *unstructured.Unstructured) (*DescendantCounts, error) {
	var res DescendantCounts
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &res)
	return &res, err
}

// Empty stub
type FolderStatus struct{}
