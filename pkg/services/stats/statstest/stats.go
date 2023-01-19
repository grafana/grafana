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

func (s *FakeService) GetAdminStats(ctx context.Context, query *stats.GetAdminStatsQuery) error {
	return s.ExpectedError
}

func (s *FakeService) GetAlertNotifiersUsageStats(ctx context.Context, query *stats.GetAlertNotifierUsageStatsQuery) error {
	query.Result = s.ExpectedNotifierUsageStats
	return s.ExpectedError
}

func (s *FakeService) GetDataSourceStats(ctx context.Context, query *stats.GetDataSourceStatsQuery) error {
	query.Result = s.ExpectedDataSourceStats
	return s.ExpectedError
}

func (s *FakeService) GetDataSourceAccessStats(ctx context.Context, query *stats.GetDataSourceAccessStatsQuery) error {
	query.Result = s.ExpectedDataSourcesAccessStats
	return s.ExpectedError
}

func (s *FakeService) GetSystemStats(ctx context.Context, query *stats.GetSystemStatsQuery) error {
	query.Result = s.ExpectedSystemStats
	return s.ExpectedError
}

func (s *FakeService) GetSystemUserCountStats(ctx context.Context, query *stats.GetSystemUserCountStatsQuery) error {
	return s.ExpectedError
}
