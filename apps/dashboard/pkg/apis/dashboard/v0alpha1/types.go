package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardVersionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DashboardVersionInfo `json:"items"`
}

// +k8s:deepcopy-gen=true
type DashboardVersionInfo struct {
	// The internal ID for this version (will be replaced with resourceVersion)
	Version int `json:"version"`

	// If the dashboard came from a previous version, it is set here
	ParentVersion int `json:"parentVersion,omitempty"`

	// The creation timestamp for this version
	Created int64 `json:"created"`

	// The user who created this version
	CreatedBy string `json:"createdBy,omitempty"`

	// Message passed while saving the version
	Message string `json:"message,omitempty"`
}

// +k8s:deepcopy-gen=true
// +k8s:conversion-gen:explicit-from=net/url.Values
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type VersionsQueryOptions struct {
	metav1.TypeMeta `json:",inline"`

	// Path is the URL path
	// +optional
	Path string `json:"path,omitempty"`

	// +optional
	Version int64 `json:"version,omitempty"`
}

// This is like the legacy DTO where access and metadata are all returned in a single call
// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardWithAccessInfo struct {
	Dashboard `json:",inline"`

	Access DashboardAccess `json:"access"`
}

// +k8s:deepcopy-gen=true
type DashboardAccess struct {
	// Metadata fields
	Slug string `json:"slug,omitempty"`
	Url  string `json:"url,omitempty"`

	// The permissions part
	CanSave                bool                  `json:"canSave"`
	CanEdit                bool                  `json:"canEdit"`
	CanAdmin               bool                  `json:"canAdmin"`
	CanStar                bool                  `json:"canStar"`
	CanDelete              bool                  `json:"canDelete"`
	AnnotationsPermissions *AnnotationPermission `json:"annotationsPermissions"`
}

// +k8s:deepcopy-gen=true
type AnnotationPermission struct {
	Dashboard    AnnotationActions `json:"dashboard"`
	Organization AnnotationActions `json:"organization"`
}

// +k8s:deepcopy-gen=true
type AnnotationActions struct {
	CanAdd    bool `json:"canAdd"`
	CanEdit   bool `json:"canEdit"`
	CanDelete bool `json:"canDelete"`
}
