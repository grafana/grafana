package statstest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/stats"
)

type FakeService struct {
	ExpectedSystemStats            *stats.SystemStats
	ExpectedDataSourceStats        []*stats.DataSourceStats
	ExpectedDataSourcesAccessStats []*stats.DataSourceAccessStats
	ExpectedNotifierUsageStats     []*stats.NotifierUsageStats

	ExpectedError error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

func (s *FakeService) GetAdminStats(ctx context.Context, query *stats.GetAdminStatsQuery) (*stats.AdminStats, error) {
	return nil, s.ExpectedError
}

func (s *FakeService) GetAlertNotifiersUsageStats(ctx context.Context, query *stats.GetAlertNotifierUsageStatsQuery) ([]*stats.NotifierUsageStats, error) {
	return s.ExpectedNotifierUsageStats, s.ExpectedError
}

func (s *FakeService) GetDataSourceStats(ctx context.Context, query *stats.GetDataSourceStatsQuery) ([]*stats.DataSourceStats, error) {
	return s.ExpectedDataSourceStats, s.ExpectedError
}

func (s *FakeService) GetDataSourceAccessStats(ctx context.Context, query *stats.GetDataSourceAccessStatsQuery) ([]*stats.DataSourceAccessStats, error) {
	return s.ExpectedDataSourcesAccessStats, s.ExpectedError
}

func (s *FakeService) GetSystemStats(ctx context.Context, query *stats.GetSystemStatsQuery) (*stats.SystemStats, error) {
	return s.ExpectedSystemStats, s.ExpectedError
}

func (s *FakeService) GetSystemUserCountStats(ctx context.Context, query *stats.GetSystemUserCountStatsQuery) (*stats.SystemUserCountStats, error) {
	return nil, s.ExpectedError
}
