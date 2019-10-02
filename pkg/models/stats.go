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
	AuthTokens            int64

	Admins         int
	Editors        int
	Viewers        int
	ActiveAdmins   int
	ActiveEditors  int
	ActiveViewers  int
	ActiveSessions int
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

type NotifierUsageStats struct {
	Type  string
	Count int64
}

type GetAlertNotifierUsageStatsQuery struct {
	Result []*NotifierUsageStats
}

type AdminStats struct {
	Orgs           int `json:"orgs"`
	Dashboards     int `json:"dashboards"`
	Snapshots      int `json:"snapshots"`
	Tags           int `json:"tags"`
	Datasources    int `json:"datasources"`
	Playlists      int `json:"playlists"`
	Stars          int `json:"stars"`
	Alerts         int `json:"alerts"`
	Users          int `json:"users"`
	Admins         int `json:"admins"`
	Editors        int `json:"editors"`
	Viewers        int `json:"viewers"`
	ActiveUsers    int `json:"activeUsers"`
	ActiveAdmins   int `json:"activeAdmins"`
	ActiveEditors  int `json:"activeEditors"`
	ActiveViewers  int `json:"activeViewers"`
	ActiveSessions int `json:"activeSessions"`
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
