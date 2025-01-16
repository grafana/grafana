// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type DatasourceCheckItem struct {
	// type of the item.
	Type DatasourceCheckItemType `json:"type"`
	// Value depends on type and describes the playlist item.
	//  - dashboard_by_id: The value is an internal numerical identifier set by Grafana. This
	//  is not portable as the numerical identifier is non-deterministic between different instances.
	//  Will be replaced by dashboard_by_uid in the future. (deprecated)
	//  - dashboard_by_tag: The value is a tag which is set on any number of dashboards. All
	//  dashboards behind the tag will be added to the playlist.
	//  - dashboard_by_uid: The value is the dashboard UID
	Value string `json:"value"`
}

// NewDatasourceCheckItem creates a new DatasourceCheckItem object.
func NewDatasourceCheckItem() *DatasourceCheckItem {
	return &DatasourceCheckItem{}
}

// +k8s:openapi-gen=true
type DatasourceCheckSpec struct {
	Title    string                `json:"title"`
	Interval string                `json:"interval"`
	Items    []DatasourceCheckItem `json:"items"`
}

// NewDatasourceCheckSpec creates a new DatasourceCheckSpec object.
func NewDatasourceCheckSpec() *DatasourceCheckSpec {
	return &DatasourceCheckSpec{}
}

// +k8s:openapi-gen=true
type DatasourceCheckItemType string

const (
	DatasourceCheckItemTypeDashboardByTag DatasourceCheckItemType = "dashboard_by_tag"
	DatasourceCheckItemTypeDashboardByUid DatasourceCheckItemType = "dashboard_by_uid"
	DatasourceCheckItemTypeDashboardById  DatasourceCheckItemType = "dashboard_by_id"
)
