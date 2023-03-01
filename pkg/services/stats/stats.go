package stats

import (
	"context"
)

type Service interface {
	GetAdminStats(ctx context.Context, query *GetAdminStatsQuery) error
	GetAlertNotifiersUsageStats(ctx context.Context, query *GetAlertNotifierUsageStatsQuery) error
	GetDataSourceStats(ctx context.Context, query *GetDataSourceStatsQuery) error
	GetDataSourceAccessStats(ctx context.Context, query *GetDataSourceAccessStatsQuery) error
	GetSystemStats(ctx context.Context, query *GetSystemStatsQuery) error
	GetSystemUserCountStats(ctx context.Context, query *GetSystemUserCountStatsQuery) error
}
