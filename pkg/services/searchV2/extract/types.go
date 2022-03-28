package extract

// empty everything will return the default
type DatasourceLookup = func(ref *DataSourceRef) *DataSourceRef

type DataSourceRef struct {
	UID  string `json:"uid"`
	Name string `json:"name"`
	Type string `json:"type"` // plugin name
}

type PanelInfo struct {
	ID              int64    `json:"id"`
	Title           string   `json:"title"`
	Description     string   `json:"description,omitempty"`
	Type            string   `json:"type,omitempty"` // PluginID
	PluginVersion   string   `json:"pluginVersion,omitempty"`
	Datasource      []string `json:"datasource,omitempty"`      // UIDs
	DatasourceType  []string `json:"datasourceType,omitempty"`  // PluginIDs
	Transformations []string `json:"transformations,omitempty"` // ids of the transformation steps

	// Rows define panels as sub objects
	Collapsed []PanelInfo `json:"collapsed,omitempty"`
}

type DashboardInfo struct {
	ID             int64       `json:"id,omitempty"`
	UID            string      `json:"uid,omitempty"`
	Path           string      `json:"path,omitempty"`
	Title          string      `json:"title"`
	Description    string      `json:"description,omitempty"`
	Tags           []string    `json:"tags"`                     // UIDs
	Datasource     []string    `json:"datasource,omitempty"`     // UIDs
	DatasourceType []string    `json:"datasourceType,omitempty"` // PluginIDs
	TemplateVars   []string    `json:"templateVars,omitempty"`   // the keys used
	Panels         []PanelInfo `json:"panels"`                   // nesed documents
	SchemaVersion  int64       `json:"schemaVersion"`
	LinkCount      int64       `json:"linkCount"`
	TimeFrom       string      `json:"timeFrom"`
	TimeTo         string      `json:"timeTo"`
	TimeZone       string      `json:"timezone"`
	Refresh        string      `json:"refresh,omitempty"`
	ReadOnly       bool        `json:"readOnly,omitempty"` // editable = false
}
