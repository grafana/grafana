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

type FakeDashboardVersionStroe struct {
	ExpectedDashboardVersion *dashver.DashboardVersion
	ExpectedError            error
}

func newDashboardVersionStoreFake() *FakeDashboardVersionStroe {
	return &FakeDashboardVersionStroe{}
}

func (f *FakeDashboardVersionStroe) Get(ctx context.Context, query *dashver.GetDashboardVersionQuery) (*dashver.DashboardVersion, error) {
	return f.ExpectedDashboardVersion, f.ExpectedError
}
