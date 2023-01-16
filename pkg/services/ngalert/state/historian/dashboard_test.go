package historian

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDashboardResolver(t *testing.T) {
	t.Run("fetches dashboards from dashboard service", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		exp := int64(14)
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			args.Get(1).(*dashboards.GetDashboardQuery).Result = &dashboards.Dashboard{ID: exp}
		}).Return(nil)
		sut := createDashboardResolverSut(dbs)

		id, err := sut.getID(context.Background(), 1, "dashboard-uid")

		require.NoError(t, err)
		require.Equal(t, exp, id)
	})

	t.Run("fetches dashboardNotFound if underlying dashboard does not exist", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			args.Get(1).(*dashboards.GetDashboardQuery).Result = nil
		}).Return(dashboards.ErrDashboardNotFound)
		sut := createDashboardResolverSut(dbs)

		_, err := sut.getID(context.Background(), 1, "not-exist")

		require.Error(t, err)
		require.ErrorIs(t, err, dashboards.ErrDashboardNotFound)
	})
}

func createDashboardResolverSut(dbs *dashboards.FakeDashboardService) *dashboardResolver {
	return newDashboardResolver(dbs, 1*time.Nanosecond)
}
