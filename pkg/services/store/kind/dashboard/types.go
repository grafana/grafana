package dashboard

import "iter"

type PanelSummaryInfo struct {
	ID            int64            `json:"id"`
	Title         string           `json:"title"`
	Description   string           `json:"description,omitempty"`
	Type          string           `json:"type,omitempty"` // PluginID
	PluginVersion string           `json:"pluginVersion,omitempty"`
	LibraryPanel  string           `json:"libraryPanel,omitempty"` // UID of referenced library panel
	Datasource    []DataSourceRef  `json:"datasource,omitempty"`   // UIDs
	Transformer   []string         `json:"transformer,omitempty"`  // ids of the transformation steps
	Queries       []PanelQueryInfo `json:"queries,omitempty"`      // per-target query expressions
	// Rows define panels as sub objects
	Collapsed []PanelSummaryInfo `json:"collapsed,omitempty"`
}

// PanelQueryInfo is the captured form of one query target on a panel.
//
// DatasourceUID holds the explicit datasource identifier the target
// referenced (uid or, for v2 schema-correct refs, name). Empty means the
// target had a null/missing datasource at parse time — consumers should
// not assume a fallback; runtime semantics for inheritance are not
// preserved here. Language inference is also left to consumers since it
// depends on the panel's datasource type (PanelSummaryInfo.Datasource).
type PanelQueryInfo struct {
	RefID         string `json:"refId,omitempty"`
	DatasourceUID string `json:"datasourceUid,omitempty"`
	Expression    string `json:"expression,omitempty"`
}

type DashboardSummaryInfo struct {
	UID           string             `json:"uid,omitempty"`
	ID            int64              `json:"id,omitempty"` // internal ID
	Title         string             `json:"title"`
	Description   string             `json:"description,omitempty"`
	Tags          []string           `json:"tags"`
	TemplateVars  []string           `json:"templateVars,omitempty"` // the keys used
	Datasource    []DataSourceRef    `json:"datasource,omitempty"`   // UIDs
	Panels        []PanelSummaryInfo `json:"panels"`                 // nesed documents
	SchemaVersion int64              `json:"schemaVersion"`
	LinkCount     int64              `json:"linkCount"`
	TimeFrom      string             `json:"timeFrom"`
	TimeTo        string             `json:"timeTo"`
	TimeZone      string             `json:"timezone"`
	Refresh       string             `json:"refresh,omitempty"`
	ReadOnly      bool               `json:"readOnly,omitempty"` // editable = false
}

func (d *DashboardSummaryInfo) PanelIterator() iter.Seq[PanelSummaryInfo] {
	return func(yield func(PanelSummaryInfo) bool) {
		for _, p := range d.Panels {
			if len(p.Collapsed) > 0 {
				for _, c := range p.Collapsed {
					if !yield(c) { // NOTE, rows can only be one level deep!
						return
					}
				}
			}
			if !yield(p) {
				return
			}
		}
	}
}
