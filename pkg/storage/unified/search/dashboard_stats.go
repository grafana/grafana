package search

import (
	"context"
)

type dashboardStats struct{}

func ProvideDashboardStats() *dashboardStats {
	return &dashboardStats{}
}

func (s *dashboardStats) GetStats(ctx context.Context, namespace string) (map[string]map[string]int64, error) {
	return nil, nil
}
