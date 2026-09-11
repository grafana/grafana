package builders

import (
	"context"
)

type OssDashboardStats struct{}

func ProvideDashboardStats() *OssDashboardStats {
	return &OssDashboardStats{}
}

func (s *OssDashboardStats) GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error) {
	return nil, nil
}

func (s *OssDashboardStats) GetDashboardStats(ctx context.Context, namespace, dashboardUid string) (map[string]int64, error) {
	return nil, nil
}
