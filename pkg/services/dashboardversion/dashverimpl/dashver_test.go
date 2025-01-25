package dashverimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestDashboardVersionService(t *testing.T) {
	dashboardVersionStore := newDashboardVersionStoreFake()
	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, features: featuremgmt.WithFeatures()}

	t.Run("Get dashboard version", func(t *testing.T) {
		dashboard := &dashver.DashboardVersion{
			ID:   11,
			Data: &simplejson.Json{},
		}
		dashboardVersionStore.ExpectedDashboardVersion = dashboard
		dashboardService.On("GetDashboardUIDByID", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).Return(&dashboards.DashboardRef{UID: "uid"}, nil)
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).Return(&dashboards.Dashboard{ID: 42}, nil)
		dashboardVersion, err := dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{})
		require.NoError(t, err)
		require.Equal(t, dashboard.ToDTO("uid"), dashboardVersion)
	})
}

func TestDeleteExpiredVersions(t *testing.T) {
	versionsToKeep := 5
	cfg := setting.NewCfg()
	cfg.DashboardVersionsToKeep = versionsToKeep

	dashboardVersionStore := newDashboardVersionStoreFake()
	dashboardService := dashboards.NewFakeDashboardService(t)
	dashboardVersionService := Service{
		cfg: cfg, store: dashboardVersionStore, dashSvc: dashboardService, features: featuremgmt.WithFeatures()}

	t.Run("Don't delete anything if there are no expired versions", func(t *testing.T) {
		err := dashboardVersionService.DeleteExpired(context.Background(), &dashver.DeleteExpiredVersionsCommand{DeletedRows: 4})
		require.Nil(t, err)
	})

	t.Run("Clean up old dashboard versions successfully", func(t *testing.T) {
		dashboardVersionStore.ExptectedDeletedVersions = 4
		dashboardVersionStore.ExpectedVersions = []any{1, 2, 3, 4}
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
	t.Run("List all versions for a given Dashboard ID", func(t *testing.T) {
		dashboardVersionStore := newDashboardVersionStoreFake()
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, features: featuremgmt.WithFeatures()}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{
			{ID: 1, DashboardID: 42},
		}
		dashboardService.On("GetDashboardUIDByID", mock.Anything,
			mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).
			Return(&dashboards.DashboardRef{UID: "uid"}, nil)

		query := dashver.ListDashboardVersionsQuery{DashboardID: 42}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res.Versions))
		// validate that the UID was populated
		require.EqualValues(t, &dashver.DashboardVersionResponse{Versions: []*dashver.DashboardVersionDTO{{ID: 1, DashboardID: 42, DashboardUID: "uid"}}}, res)
	})

	t.Run("List all versions for a non-existent DashboardID", func(t *testing.T) {
		dashboardVersionStore := newDashboardVersionStoreFake()
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, log: log.NewNopLogger(), features: featuremgmt.WithFeatures()}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{
			{ID: 1, DashboardID: 42},
		}
		dashboardService.On("GetDashboardUIDByID", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardRefByIDQuery")).
			Return(nil, dashboards.ErrDashboardNotFound).Once()

		query := dashver.ListDashboardVersionsQuery{DashboardID: 42}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res.Versions))
		// The DashboardID remains populated with the given value, even though the dash was not found
		require.EqualValues(t, &dashver.DashboardVersionResponse{Versions: []*dashver.DashboardVersionDTO{{ID: 1, DashboardID: 42}}}, res)
	})

	t.Run("List all versions for a given DashboardUID", func(t *testing.T) {
		dashboardVersionStore := newDashboardVersionStoreFake()
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, log: log.NewNopLogger(), features: featuremgmt.WithFeatures()}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{{DashboardID: 42, ID: 1}}
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).
			Return(&dashboards.Dashboard{ID: 42}, nil)

		query := dashver.ListDashboardVersionsQuery{DashboardUID: "uid"}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res.Versions))
		// validate that the dashboardID was populated from the GetDashboard method call.
		require.EqualValues(t, &dashver.DashboardVersionResponse{Versions: []*dashver.DashboardVersionDTO{{ID: 1, DashboardID: 42, DashboardUID: "uid"}}}, res)
	})

	t.Run("List all versions for a given non-existent DashboardUID", func(t *testing.T) {
		dashboardVersionStore := newDashboardVersionStoreFake()
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, log: log.NewNopLogger(), features: featuremgmt.WithFeatures()}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersion{{DashboardID: 42, ID: 1}}
		dashboardService.On("GetDashboard", mock.Anything, mock.AnythingOfType("*dashboards.GetDashboardQuery")).
			Return(nil, dashboards.ErrDashboardNotFound)

		query := dashver.ListDashboardVersionsQuery{DashboardUID: "uid"}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res.Versions))
		// validate that the dashboardUID & ID are populated, even though the dash was not found
		require.EqualValues(t, &dashver.DashboardVersionResponse{Versions: []*dashver.DashboardVersionDTO{{ID: 1, DashboardID: 42, DashboardUID: "uid"}}}, res)
	})

	t.Run("List Dashboard versions - error from store", func(t *testing.T) {
		dashboardVersionStore := newDashboardVersionStoreFake()
		dashboardService := dashboards.NewFakeDashboardService(t)
		dashboardVersionService := Service{store: dashboardVersionStore, dashSvc: dashboardService, log: log.NewNopLogger(), features: featuremgmt.WithFeatures()}
		dashboardVersionStore.ExpectedError = dashver.ErrDashboardVersionNotFound

		query := dashver.ListDashboardVersionsQuery{DashboardID: 42, DashboardUID: "42"}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, res)
		require.ErrorIs(t, err, dashver.ErrDashboardVersionNotFound)
	})
}

type FakeDashboardVersionStore struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExptectedDeletedVersions int64
	ExpectedVersions         []any
	ExpectedListVersions     []*dashver.DashboardVersion
	ExpectedError            error
}

func newDashboardVersionStoreFake() *FakeDashboardVersionStore {
	return &FakeDashboardVersionStore{}
}

func (f *FakeDashboardVersionStore) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	return f.ExpectedDashboardVersion, f.ExpectedError
}

func (f *FakeDashboardVersionStore) GetBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, perBatch int, versionsToKeep int) ([]any, error) {
	return f.ExpectedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) DeleteBatch(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []any) (int64, error) {
	return f.ExptectedDeletedVersions, f.ExpectedError
}

func (f *FakeDashboardVersionStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersion, error) {
	return f.ExpectedListVersions, f.ExpectedError
}
