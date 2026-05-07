package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// +k8s:deepcopy-gen=true
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

func (LibraryPanel) OpenAPIModelName() string {
	return OpenAPIPrefix + "LibraryPanel"
}

// +k8s:deepcopy-gen=true
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type LibraryPanelList struct {
	metav1.TypeMeta `json:",inline"`
	// +optional
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []LibraryPanel `json:"items"`
}

func (LibraryPanelList) OpenAPIModelName() string {
	return OpenAPIPrefix + "LibraryPanelList"
}

// +k8s:deepcopy-gen=true
type LibraryPanelSpec struct {
	// The panel type
	Type string `json:"type"`

	// The panel type
	PluginVersion string `json:"pluginVersion,omitempty"`

	// The title of the library panel
	Title string `json:"title,omitempty"`

	// The title of the panel when displayed in the dashboard
	PanelTitle string `json:"panelTitle,omitempty"`

	// Library panel description
	Description string `json:"description,omitempty"`

	// The options schema depends on the panel type
	Options common.Unstructured `json:"options"`

	// The fieldConfig schema depends on the panel type
	FieldConfig common.Unstructured `json:"fieldConfig"`

	// The default datasource type
	Datasource *data.DataSourceRef `json:"datasource,omitempty"`

	// The grid position
	GridPos GridPos `json:"gridPos,omitempty"`

	// Whether the panel is transparent
	Transparent bool `json:"transparent,omitempty"`

	// The links for the panel
	Links []common.Unstructured `json:"links,omitempty"`

	// The datasource queries
	// +listType=atomic
	Targets []data.DataQuery `json:"targets,omitempty"`
}

func (LibraryPanelSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "LibraryPanelSpec"
}

// +k8s:deepcopy-gen=true
type GridPos struct {
	W int `json:"w"`
	H int `json:"h"`
	X int `json:"x"`
	Y int `json:"y"`
}

func (GridPos) OpenAPIModelName() string {
	return OpenAPIPrefix + "GridPos"
}

// +k8s:deepcopy-gen=true
type LibraryPanelStatus struct {
	// Translation warnings (mostly things that were in SQL columns but not found in the saved body)
	Warnings []string `json:"warnings,omitempty"`

	// The properties previously stored in SQL that are not included in this model
	Missing common.Unstructured `json:"missing,omitempty"`
}

func (LibraryPanelStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "LibraryPanelStatus"
}
