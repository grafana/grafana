// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type PluginCheckItem struct {
	// type of the item.
	Type PluginCheckItemType `json:"type"`
	// Value depends on type and describes the playlist item.
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	Value string `json:"value"`
}

// NewPluginCheckItem creates a new PluginCheckItem object.
func NewPluginCheckItem() *PluginCheckItem {
	return &PluginCheckItem{}
}

// +k8s:openapi-gen=true
type PluginCheckSpec struct {
	Title    string            `json:"title"`
	Interval string            `json:"interval"`
	Items    []PluginCheckItem `json:"items"`
}

// NewPluginCheckSpec creates a new PluginCheckSpec object.
func NewPluginCheckSpec() *PluginCheckSpec {
	return &PluginCheckSpec{}
}

// +k8s:openapi-gen=true
type PluginCheckItemType string

const (
	PluginCheckItemTypeDashboardByTag PluginCheckItemType = "dashboard_by_tag"
	PluginCheckItemTypeDashboardByUid PluginCheckItemType = "dashboard_by_uid"
	PluginCheckItemTypeDashboardById  PluginCheckItemType = "dashboard_by_id"
)
