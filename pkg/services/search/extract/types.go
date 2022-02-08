package extract

type datasourceLookup = func(key string) *datasourceInfo

type datasourceInfo struct {
	UID     string `json:"uid"`
	Name    string `json:"name"`
	Type    string `json:"type"` // plugin name
	Version string `json:"version"`
	Access  string `json:"access,omitempty"` // proxy, direct, or empty
}

type panelInfo struct {
	ID              int64    `json:"id"`
	Title           string   `json:"title"`
	Description     string   `json:"description,omitempty"`
	Type            string   `json:"type"`                      // PluginID
	Datasource      []string `json:"datasource,omitempty"`      // UIDs
	DatasourceType  []string `json:"datasourceType,omitempty"`  // PluginIDs
	Transformations []string `json:"transformations,omitempty"` // ids of the transformation steps

	// Rows define panels as sub objects
	Collapsed []panelInfo `json:"collapsed,omitempty"`
}

type dashboardInfo struct {
	ID             int64       `json:"id,omitempty"`
	UID            string      `json:"uid,omitempty"`
	Path           string      `json:"path,omitempty"`
	Title          string      `json:"title"`
	Description    string      `json:"description,omitempty"`
	Tags           []string    `json:"tags"`                     // UIDs
	Datasource     []string    `json:"datasource,omitempty"`     // UIDs
	DatasourceType []string    `json:"datasourceType,omitempty"` // PluginIDs
	TemplateVars   []string    `json:"templateVars,omitempty"`   // the keys used
	Panels         []panelInfo `json:"panels"`                   // nesed documents
	SchemaVersion  int64       `json:"schemaVersion"`
	LinkCount      int64       `json:"linkCount"`
	TimeFrom       string      `json:"timeFrom"`
	TimeTo         string      `json:"timeTo"`
	TimeZone       string      `json:"timezone"`
	Refresh        string      `json:"refresh,omitempty"`
	ReadOnly       bool        `json:"readOnly,omitempty"` // editable = false
}
