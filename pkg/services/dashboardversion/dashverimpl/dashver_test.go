package dashverimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardVersionService(t *testing.T) {
	dashboardVersionStore := newDashboardVersionStoreFake()
	dashSvc := dashboards.NewFakeDashboardService(t)
	dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashSvc}

	t.Run("Get dashboard version", func(t *testing.T) {
		dashboard := &dashver.DashboardVersion{
			ID:   11,
			Data: &simplejson.Json{},
		}
		dashboardVersionStore.ExpectedDashboardVersion = dashboard
		dashSvc.On("GetDashboardUIDById", mock.Anything, mock.AnythingOfType("*models.GetDashboardRefByIdQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardRefByIdQuery)
			q.Result = &models.DashboardRef{Uid: "uid"}
		}).Return(nil)
		dashboardVersion, err := dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{})
		require.NoError(t, err)
		expect := dashboard.ToDTO("uid")
		require.Equal(t, expect, dashboardVersion)
	})
}

func TestDeleteExpiredVersions(t *testing.T) {
	versionsToKeep := 5
	setting.DashboardVersionsToKeep = versionsToKeep
	dashboardVersionStore := newDashboardVersionStoreFake()
	dashboardVersionService := Service{store: dashboardVersionStore}

	t.Run("Don't delete anything if there are no expired versions", func(t *testing.T) {
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.Nil(t, err)
	})

	t.Run("Clean up old dashboard versions successfully", func(t *testing.T) {
		dashboardVersionStore.ExptectedDeletedVersions = 4
		dashboardVersionStore.ExpectedVersions = []interface{}{1, 2, 3, 4}
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.Nil(t, err)
	})

	t.Run("Clean up old dashboard versions with error", func(t *testing.T) {
		dashboardVersionStore.ExpectedError = errors.New("some error")
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.NotNil(t, err)
	})
}

func TestListDashboardVersions(t *testing.T) {
	dashboardVersionStore := newDashboardVersionStoreFake()
	dashSvc := dashboards.NewFakeDashboardService(t)

	dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashSvc}

	t.Run("Get all versions for a given Dashboard ID", func(t *testing.T) {
		query := dashver.ListDashboardVersionsQuery{}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{{}}
		dashSvc.On("GetDashboardUIDById", mock.Anything, mock.AnythingOfType("*models.GetDashboardRefByIdQuery")).Return(nil)
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res))
	})

	t.Run("Get all versions for a given Dashboard UID", func(t *testing.T) {
		query := dashver.ListDashboardVersionsQuery{DashboardUID: "test"}
		dashSvc.On("GetDashboard", mock.Anything, mock.AnythingOfType("*models.GetDashboardQuery")).Run(func(args mock.Arguments) {
			q := args.Get(1).(*models.GetDashboardQuery)
			q.Result = &models.Dashboard{Id: 0}
		}).Return(nil)
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{{}}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res))
	})
}

type FakeDashboardVersionStore struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExptectedDeletedVersions int64
	ExpectedVersions         []interface{}
	ExpectedListVersions     []*dashver.DashboardVersion
	ExpectedError            error
}

func newDashboardVersionStoreFake() *FakeDashboardVersionStore {
	return &FakeDashboardVersionStore{}
}

func (f *FakeDashboardVersionStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	return f.ExpectedDashboardVersion, f.ExpectedError
}

func (f *FakeDashboardVersionStore) GetBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, perBatch int, versionsToKeep int) ([]interface{}, error) {
	return f.ExpectedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) DeleteBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []interface{}) (int64, error) {
	return f.ExptectedDeletedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	return f.ExpectedListVersions, f.ExpectedError
}
