package dashverimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestDashboardVersionService(t *testing.T) {
	dashboardVersionStore := newDashboardVersionStoreFake()
	dashboardVersionService := Service{store: dashboardVersionStore}

	t.Run("Get dashboard version", func(t *testing.T) {
		dashboard := &dashver.DashboardVersion{
			ID:   11,
			Data: &simplejson.Json{},
		}
		dashboardVersionStore.ExpectedDashboardVersion = dashboard
		dashboardVersion, err := dashboardVersionService.Get(context.Background(), &dashver.GetDashboardVersionQuery{})
		require.NoError(t, err)
		require.Equal(t, dashboardVersion, dashboard)
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
	dashboardVersionService := Service{store: dashboardVersionStore}

	t.Run("Get all versions for a given Dashboard ID", func(t *testing.T) {
		query := dashver.ListDashboardVersionsQuery{}
		dashboardVersionStore.ExpectedListVersions = []*dashver.DashboardVersionDTO{{}}
		res, err := dashboardVersionService.List(context.Background(), &query)
		require.Nil(t, err)
		require.Equal(t, 1, len(res))
	})
}

type FakeDashboardVersionStore struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExptectedDeletedVersions int64
	ExpectedVersions         []interface{}
	ExpectedListVersions     []*dashver.DashboardVersionDTO
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

func (f *FakeDashboardVersionStore) List(ctx context.Context, query *dashver.ListDashboardVersionsQuery) ([]*dashver.DashboardVersionDTO, error) {
	return f.ExpectedListVersions, f.ExpectedError
}
