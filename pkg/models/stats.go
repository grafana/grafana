package models

type SystemStats struct {
	Dashboards                int64
	Datasources               int64
	Users                     int64
	ActiveUsers               int64
	DailyActiveUsers          int64
	MonthlyActiveUsers        int64
	Orgs                      int64
	Playlists                 int64
	Alerts                    int64
	Stars                     int64
	Snapshots                 int64
	Teams                     int64
	DashboardPermissions      int64
	FolderPermissions         int64
	Folders                   int64
	ProvisionedDashboards     int64
	AuthTokens                int64
	APIKeys                   int64 `xorm:"api_keys"`
	DashboardVersions         int64
	Annotations               int64
	AlertRules                int64
	LibraryPanels             int64
	LibraryVariables          int64
	DashboardsViewersCanEdit  int64
	DashboardsViewersCanAdmin int64
	FoldersViewersCanEdit     int64
	FoldersViewersCanAdmin    int64
	Admins                    int64
	Editors                   int64
	Viewers                   int64
	ActiveAdmins              int64
	ActiveEditors             int64
	ActiveViewers             int64
	ActiveSessions            int64
	DailyActiveAdmins         int64
	DailyActiveEditors        int64
	DailyActiveViewers        int64
	DailyActiveSessions       int64
	DataKeys                  int64
	ActiveDataKeys            int64
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
	Orgs                int64 `json:"orgs"`
	Dashboards          int64 `json:"dashboards"`
	Snapshots           int64 `json:"snapshots"`
	Tags                int64 `json:"tags"`
	Datasources         int64 `json:"datasources"`
	Playlists           int64 `json:"playlists"`
	Stars               int64 `json:"stars"`
	Alerts              int64 `json:"alerts"`
	Users               int64 `json:"users"`
	Admins              int64 `json:"admins"`
	Editors             int64 `json:"editors"`
	Viewers             int64 `json:"viewers"`
	ActiveUsers         int64 `json:"activeUsers"`
	ActiveAdmins        int64 `json:"activeAdmins"`
	ActiveEditors       int64 `json:"activeEditors"`
	ActiveViewers       int64 `json:"activeViewers"`
	ActiveSessions      int64 `json:"activeSessions"`
	DailyActiveUsers    int64 `json:"dailyActiveUsers"`
	DailyActiveAdmins   int64 `json:"dailyActiveAdmins"`
	DailyActiveEditors  int64 `json:"dailyActiveEditors"`
	DailyActiveViewers  int64 `json:"dailyActiveViewers"`
	DailyActiveSessions int64 `json:"dailyActiveSessions"`
	MonthlyActiveUsers  int64 `json:"monthlyActiveUsers"`
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

type UserStats struct {
	Users   int64
	Admins  int64
	Editors int64
	Viewers int64
}
