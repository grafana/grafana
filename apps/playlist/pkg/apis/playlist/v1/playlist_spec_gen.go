// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1

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

// +k8s:openapi-gen=true
type PlaylistSpec struct {
	Title    string         `json:"title"`
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
}

// NewPlaylistSpec creates a new PlaylistSpec object.
func NewPlaylistSpec() *PlaylistSpec {
	return &PlaylistSpec{
		Items: []PlaylistItem{},
	}
}

// +k8s:openapi-gen=true
type PlaylistPlaylistItemType string

const (
	PlaylistPlaylistItemTypeDashboardByTag PlaylistPlaylistItemType = "dashboard_by_tag"
	PlaylistPlaylistItemTypeDashboardByUid PlaylistPlaylistItemType = "dashboard_by_uid"
	PlaylistPlaylistItemTypeDashboardById  PlaylistPlaylistItemType = "dashboard_by_id"
)

func (PlaylistItem) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistItem"
}
func (PlaylistSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.playlist.pkg.apis.playlist.v0alpha1.PlaylistSpec"
}
