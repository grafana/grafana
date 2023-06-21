package stats

import (
	"context"
)

type Service interface {
	GetAdminStats(ctx context.Context, query *GetAdminStatsQuery) (*AdminStats, error)
	GetAlertNotifiersUsageStats(ctx context.Context, query *GetAlertNotifierUsageStatsQuery) ([]*NotifierUsageStats, error)
	GetDataSourceStats(ctx context.Context, query *GetDataSourceStatsQuery) ([]*DataSourceStats, error)
	GetDataSourceAccessStats(ctx context.Context, query *GetDataSourceAccessStatsQuery) ([]*DataSourceAccessStats, error)
	GetSystemStats(ctx context.Context, query *GetSystemStatsQuery) (*SystemStats, error)
	GetSystemUserCountStats(ctx context.Context, query *GetSystemUserCountStatsQuery) (*SystemUserCountStats, error)
}
