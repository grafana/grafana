package models

type SystemStats struct {
	DashboardCount int
	UserCount      int
	OrgCount       int
}

type GetSystemStatsQuery struct {
	Result *SystemStats
}
