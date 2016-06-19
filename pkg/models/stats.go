package models

type SystemStats struct {
	DashboardCount int
	UserCount      int
	OrgCount       int
	PlaylistCount  int
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
}

type GetAdminStatsQuery struct {
	Result *AdminStats
}
