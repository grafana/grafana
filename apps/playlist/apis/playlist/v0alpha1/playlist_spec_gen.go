package v0alpha1

// Defines values for PlaylistItemType.
const (
	PlaylistItemTypeDashboardById  PlaylistItemType = "dashboard_by_id"
	PlaylistItemTypeDashboardByTag PlaylistItemType = "dashboard_by_tag"
	PlaylistItemTypeDashboardByUid PlaylistItemType = "dashboard_by_uid"
)

// PlaylistItem defines model for PlaylistItem.
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

// PlaylistItemType type of the item.
// +k8s:openapi-gen=true
type PlaylistItemType string

// PlaylistSpec defines model for PlaylistSpec.
// +k8s:openapi-gen=true
type PlaylistSpec struct {
	Interval string         `json:"interval"`
	Items    []PlaylistItem `json:"items"`
	Title    string         `json:"title"`
}
