package dashboard

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Dashboard struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The dashboard body (unstructured for now)
	Spec DashboardSpec `json:"spec"`
}

type DashboardSpec struct {
	Title               string `json:"title"`
	common.Unstructured `json:",inline"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Dashboard `json:"items,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardVersionList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DashboardVersionInfo `json:"items,omitempty"`
}

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

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type LibraryPanel struct {
	metav1.TypeMeta `json:",inline"`
	// Standard object's metadata
	// More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#metadata
	// +optional
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// Panel properties
	Spec LibraryPanelSpec `json:"spec"`

	// Status will show errors
	Status *LibraryPanelStatus `json:"status,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type LibraryPanelList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []LibraryPanel `json:"items,omitempty"`
}

type LibraryPanelSpec struct {
	// The panel type
	Type string `json:"type"`

	// The panel type
	PluginVersion string `json:"pluginVersion,omitempty"`

	// The panel title
	Title string `json:"title,omitempty"`

	// Library panel description
	Description string `json:"description,omitempty"`

	// The options schema depends on the panel type
	Options common.Unstructured `json:"options"`

	// The fieldConfig schema depends on the panel type
	FieldConfig common.Unstructured `json:"fieldConfig"`

	// The default datasource type
	Datasource *data.DataSourceRef `json:"datasource,omitempty"`

	// The datasource queries
	// +listType=set
	Targets []data.DataQuery `json:"targets,omitempty"`
}

type LibraryPanelStatus struct {
	// Translation warnings (mostly things that were in SQL columns but not found in the saved body)
	Warnings []string `json:"warnings,omitempty"`

	// The properties previously stored in SQL that are not included in this model
	Missing common.Unstructured `json:"missing,omitempty"`
}

// This is like the legacy DTO where access and metadata are all returned in a single call
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardWithAccessInfo struct {
	Dashboard `json:",inline"`

	Access DashboardAccess `json:"access"`
}

// Information about how the requesting user can use a given dashboard
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

type AnnotationPermission struct {
	Dashboard    AnnotationActions `json:"dashboard"`
	Organization AnnotationActions `json:"organization"`
}

type AnnotationActions struct {
	CanAdd    bool `json:"canAdd"`
	CanEdit   bool `json:"canEdit"`
	CanDelete bool `json:"canDelete"`
}
