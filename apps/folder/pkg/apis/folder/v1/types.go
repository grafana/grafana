package v1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

const OpenAPIPrefix = "com.github.grafana.grafana.apps.folder.pkg.apis.folder.v1."

// FolderInfoList returns a list of folder references (parents or children)
// Unlike FolderList, each item is not a full k8s object
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderInfoList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=map
	// +listMapKey=uid
	Items []FolderInfo `json:"items"`
}

func (FolderInfoList) OpenAPIModelName() string {
	return OpenAPIPrefix + "FolderInfoList"
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

func (FolderInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "FolderInfo"
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

	// AccessControl is a flat map of folder-domain action strings to bool,
	// reflecting permissions after parent-chain inheritance has been resolved
	// by the authorization system. Mirrors the shape of legacy
	// dtos.Folder.AccessControl so clients can drop their dual call to
	// /api/folders/{uid}?accesscontrol=true. Only keys for actions the user
	// is granted appear here; absent keys mean "not granted".
	// +optional
	AccessControl map[string]bool `json:"accessControl,omitempty"`
}

func (FolderAccessInfo) OpenAPIModelName() string {
	return OpenAPIPrefix + "FolderAccessInfo"
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DescendantCounts struct {
	metav1.TypeMeta `json:",inline"`

	Counts []ResourceStats `json:"counts"`
}

func (DescendantCounts) OpenAPIModelName() string {
	return OpenAPIPrefix + "DescendantCounts"
}

type ResourceStats struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

func (ResourceStats) OpenAPIModelName() string {
	return OpenAPIPrefix + "ResourceStats"
}

func UnstructuredToDescendantCounts(obj *unstructured.Unstructured) (*DescendantCounts, error) {
	var res DescendantCounts
	err := runtime.DefaultUnstructuredConverter.FromUnstructured(obj.Object, &res)
	return &res, err
}
