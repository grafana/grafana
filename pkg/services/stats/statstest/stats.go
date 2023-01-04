package statstest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type FakeService struct {
	ExpectedSystemStats            *models.SystemStats
	ExpectedDataSourceStats        []*models.DataSourceStats
	ExpectedDataSourcesAccessStats []*models.DataSourceAccessStats
	ExpectedNotifierUsageStats     []*models.NotifierUsageStats

	ExpectedError error
}

func NewFakeService() *FakeService {
	return &FakeService{}
}

func (s *FakeService) GetAdminStats(ctx context.Context, query *models.GetAdminStatsQuery) error {
	return s.ExpectedError
}

func (s *FakeService) GetAlertNotifiersUsageStats(ctx context.Context, query *models.GetAlertNotifierUsageStatsQuery) error {
	query.Result = s.ExpectedNotifierUsageStats
	return s.ExpectedError
}

func (s *FakeService) GetDataSourceStats(ctx context.Context, query *models.GetDataSourceStatsQuery) error {
	query.Result = s.ExpectedDataSourceStats
	return s.ExpectedError
}

func (s *FakeService) GetDataSourceAccessStats(ctx context.Context, query *models.GetDataSourceAccessStatsQuery) error {
	query.Result = s.ExpectedDataSourcesAccessStats
	return s.ExpectedError
}

func (s *FakeService) GetSystemStats(ctx context.Context, query *models.GetSystemStatsQuery) error {
	query.Result = s.ExpectedSystemStats
	return s.ExpectedError
}

func (s *FakeService) GetSystemUserCountStats(ctx context.Context, query *models.GetSystemUserCountStatsQuery) error {
	return s.ExpectedError
}
