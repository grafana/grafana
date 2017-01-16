package models

type SystemStats struct {
	DashboardCount int64
	UserCount      int64
	OrgCount       int64
	PlaylistCount  int64
	AlertCount     int64
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

type AdminStats struct {
	UserCount       int `json:"user_count"`
	OrgCount        int `json:"org_count"`
	DashboardCount  int `json:"dashboard_count"`
	DbSnapshotCount int `json:"db_snapshot_count"`
	DbTagCount      int `json:"db_tag_count"`
	DataSourceCount int `json:"data_source_count"`
	PlaylistCount   int `json:"playlist_count"`
	StarredDbCount  int `json:"starred_db_count"`
	AlertCount      int `json:"alert_count"`
}

type GetAdminStatsQuery struct {
	Result *AdminStats
}
