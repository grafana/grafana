package models

type SystemStats struct {
	Dashboards            int64
	Datasources           int64
	Users                 int64
	ActiveUsers           int64
	Orgs                  int64
	Playlists             int64
	Alerts                int64
	Stars                 int64
	Snapshots             int64
	Teams                 int64
	DashboardPermissions  int64
	FolderPermissions     int64
	Folders               int64
	ProvisionedDashboards int64
}

type DataSourceStats struct {
	Count int
	Type  string
}

type GetSystemStatsQuery struct {
	Result *SystemStats
}

type GetDataSourceStatsQuery struct {
	Result []*DataSourceStats
}

type DataSourceAccessStats struct {
	Type   string
	Access string
	Count  int64
}

type GetDataSourceAccessStatsQuery struct {
	Result []*DataSourceAccessStats
}

type AdminStats struct {
	Users       int `json:"users"`
	Orgs        int `json:"orgs"`
	Dashboards  int `json:"dashboards"`
	Snapshots   int `json:"snapshots"`
	Tags        int `json:"tags"`
	Datasources int `json:"datasources"`
	Playlists   int `json:"playlists"`
	Stars       int `json:"stars"`
	Alerts      int `json:"alerts"`
	ActiveUsers int `json:"activeUsers"`
}

type GetAdminStatsQuery struct {
	Result *AdminStats
}

type SystemUserCountStats struct {
	Count int64
}

type GetSystemUserCountStatsQuery struct {
	Result *SystemUserCountStats
}
