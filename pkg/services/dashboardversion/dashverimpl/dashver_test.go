package dashverimpl

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/components/simplejson"
	dashver "github.com/grafana/grafana/pkg/services/dashboardversion"
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

type FakeDashboardVersionStore struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExptectedDeletedVersions int64
	ExpectedVersions         []interface{}
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

func (f *FakeDashboardVersionStore) Delete(ctx context.Context, cmd *dashver.DeleteExpiredVersionsCommand, versionIdsToDelete []interface{}) (int64, error) {
	return f.ExptectedDeletedVersions, f.ExpectedError
}
