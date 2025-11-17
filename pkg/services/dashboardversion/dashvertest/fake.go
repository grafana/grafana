package dashvertest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
)

type FakeDashboardVersionService struct {
	ExpectedDashboardVersion     *dashver.DashboardVersionDTO
	ExpectedDashboardVersions    []*dashver.DashboardVersionDTO
	ExpectedListDashboarVersions []*dashver.DashboardVersionDTO
	ExpectedContinueToken        string
	counter                      int
	ExpectedError                error
	// New fields for RestoreVersion testing
	ExpectedRestoreResult *dashboards.Dashboard
	RestoreVersionCalled  bool
	LastRestoreCommand    *dashver.RestoreVersionCommand
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

func (f *FakeDashboardVersionService) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) (*dashver.DashboardVersionResponse, error) {
	return &dashver.DashboardVersionResponse{
		ContinueToken: f.ExpectedContinueToken,
		Versions:      f.ExpectedListDashboarVersions,
	}, f.ExpectedError
}

func (f *FakeDashboardVersionService) RestoreVersion(ctx context.Context, cmd *dashver.RestoreVersionCommand) (*dashboards.Dashboard, error) {
	f.RestoreVersionCalled = true
	f.LastRestoreCommand = cmd
	return f.ExpectedRestoreResult, f.ExpectedError
}
