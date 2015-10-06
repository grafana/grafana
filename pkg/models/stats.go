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
