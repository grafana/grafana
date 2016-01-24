package models

type SystemStats struct {
	DashboardCount int
	UserCount      int
	OrgCount       int
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
  UserCount       int
  OrgCount        int
  DashboardCount  int 
  DBSnapshotCount int
  DBTagCount      int
  DataSourceCount int
  PlaylistCount   int
  StarredDBCount  int
}

type GetAdminStatsQuery struct {
  Result *AdminStats
}
