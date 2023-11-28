package dashvertest

import (
	"context"

	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

type FakeDashboardVersionService struct {
	ExpectedDashboardVersion     *dashver.DashboardVersionDTO
	ExpectedDashboardVersions    []*dashver.DashboardVersionDTO
	ExpectedListDashboarVersions []*dashver.DashboardVersionDTO
	counter                      int
	ExpectedError                error
}

func NewDashboardVersionServiceFake() *FakeDashboardVersionService {
	return &FakeDashboardVersionService{}
}

func (f *FakeDashboardVersionService) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersionDTO, error) {
	if len(f.ExpectedDashboardVersions) == 0 {
		return f.ExpectedDashboardVersion, f.ExpectedError
	}
	f.counter++
	return f.ExpectedDashboardVersions[f.counter-1], f.ExpectedError
}

func (f *FakeDashboardVersionService) DeleteExpired(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand) error {
	return f.ExpectedError
}

func (f *FakeDashboardVersionService) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersionDTO, error) {
	return f.ExpectedListDashboarVersions, f.ExpectedError
}
