package plugins

type PluginDashboardInfoDTO struct {
	UID              string `json:"uid"`
	PluginId         string `json:"pluginId"`
	Title            string `json:"title"`
	Imported         bool   `json:"imported"`
	ImportedUri      string `json:"importedUri"`
	ImportedUrl      string `json:"importedUrl"`
	Slug             string `json:"slug"`
	DashboardId      int64  `json:"dashboardId"`
	FolderId         int64  `json:"folderId"`
	ImportedRevision int64  `json:"importedRevision"`
	Revision         int64  `json:"revision"`
	Description      string `json:"description"`
	Path             string `json:"path"`
	Removed          bool   `json:"removed"`
}
