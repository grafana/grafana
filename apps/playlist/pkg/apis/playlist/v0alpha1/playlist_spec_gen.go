// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PlaylistItem = PlaylistPlaylistItem

// NewPlaylistItem creates a new PlaylistItem object.
func NewPlaylistItem() *PlaylistItem {
	return NewPlaylistPlaylistItem()
}

// Shared item definition for all versions
// +k8s:openapi-gen=true
type PlaylistPlaylistItem struct {
	// type of the item.
	Type PlaylistPlaylistItemType `json:"type"`
	// Value depends on type and describes the playlist item.
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	Value string `json:"value"`
}

// NewPlaylistPlaylistItem creates a new PlaylistPlaylistItem object.
func NewPlaylistPlaylistItem() *PlaylistPlaylistItem {
	return &PlaylistPlaylistItem{}
}

// OpenAPIModelName returns the OpenAPI model name for PlaylistPlaylistItem.
func (PlaylistPlaylistItem) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistPlaylistItem"
}

// A named set of dashboard query parameters (variables and time range) applied during playlist playback
// +k8s:openapi-gen=true
type PlaylistPlaylistVariableSet struct {
	// Optional display name for this variable set.
	Name *string `json:"name,omitempty"`
	// Query parameters to append when opening each playlist dashboard. Use var-<name> for dashboard variables and from/to for time range overrides.
	QueryParams map[string]string `json:"queryParams"`
}

// NewPlaylistPlaylistVariableSet creates a new PlaylistPlaylistVariableSet object.
func NewPlaylistPlaylistVariableSet() *PlaylistPlaylistVariableSet {
	return &PlaylistPlaylistVariableSet{
		QueryParams: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PlaylistPlaylistVariableSet.
func (PlaylistPlaylistVariableSet) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistPlaylistVariableSet"
}

// +k8s:openapi-gen=true
type PlaylistSpec struct {
	Title        string                        `json:"title"`
	Interval     string                        `json:"interval"`
	Items        []PlaylistItem                `json:"items"`
	VariableSets []PlaylistPlaylistVariableSet `json:"variableSets,omitempty"`
}

// NewPlaylistSpec creates a new PlaylistSpec object.
func NewPlaylistSpec() *PlaylistSpec {
	return &PlaylistSpec{
		Items: []PlaylistItem{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for PlaylistSpec.
func (PlaylistSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistSpec"
}

// +k8s:openapi-gen=true
type PlaylistPlaylistItemType string

const (
	PlaylistPlaylistItemTypeDashboardByTag PlaylistPlaylistItemType = "dashboard_by_tag"
	PlaylistPlaylistItemTypeDashboardByUid PlaylistPlaylistItemType = "dashboard_by_uid"
	PlaylistPlaylistItemTypeDashboardById  PlaylistPlaylistItemType = "dashboard_by_id"
)

// OpenAPIModelName returns the OpenAPI model name for PlaylistPlaylistItemType.
func (PlaylistPlaylistItemType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistPlaylistItemType"
}
