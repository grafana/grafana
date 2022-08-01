package extract

import (
	"github.com/grafana/grafana/pkg/services/searchV2/dslookup"
)

type PanelInfo struct {
	ID            int64                    `json:"id"`
	Title         string                   `json:"title"`
	Description   string                   `json:"description,omitempty"`
	Type          string                   `json:"type,omitempty"` // PluginID
	PluginVersion string                   `json:"pluginVersion,omitempty"`
	Datasource    []dslookup.DataSourceRef `json:"datasource,omitempty"`  // UIDs
	Transformer   []string                 `json:"transformer,omitempty"` // ids of the transformation steps

	// Rows define panels as sub objects
	Collapsed []PanelInfo `json:"collapsed,omitempty"`
}

type DashboardInfo struct {
	UID           string                   `json:"uid,omitempty"`
	ID            int64                    `json:"id,omitempty"` // internal ID
	Title         string                   `json:"title"`
	Description   string                   `json:"description,omitempty"`
	Tags          []string                 `json:"tags"`
	TemplateVars  []string                 `json:"templateVars,omitempty"` // the keys used
	Datasource    []dslookup.DataSourceRef `json:"datasource,omitempty"`   // UIDs
	Panels        []PanelInfo              `json:"panels"`                 // nesed documents
	SchemaVersion int64                    `json:"schemaVersion"`
	LinkCount     int64                    `json:"linkCount"`
	TimeFrom      string                   `json:"timeFrom"`
	TimeTo        string                   `json:"timeTo"`
	TimeZone      string                   `json:"timezone"`
	Refresh       string                   `json:"refresh,omitempty"`
	ReadOnly      bool                     `json:"readOnly,omitempty"` // editable = false
}
