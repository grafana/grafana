// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PlaylistItem struct {
	// type of the item.
	Type PlaylistItemType `json:"type"`
	// Value depends on type and describes the playlist item.
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	Value string `json:"value"`
}

// NewPlaylistItem creates a new PlaylistItem object.
func NewPlaylistItem() *PlaylistItem {
	return &PlaylistItem{}
}

// +k8s:openapi-gen=true
type PlaylistSpec struct {
	Title    string         `json:"title"`
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
}

// NewPlaylistSpec creates a new PlaylistSpec object.
func NewPlaylistSpec() *PlaylistSpec {
	return &PlaylistSpec{}
}

// +k8s:openapi-gen=true
type PlaylistItemType string

const (
	PlaylistItemTypeDashboardByTag PlaylistItemType = "dashboard_by_tag"
	PlaylistItemTypeDashboardByUid PlaylistItemType = "dashboard_by_uid"
	PlaylistItemTypeDashboardById  PlaylistItemType = "dashboard_by_id"
)
