package historian

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestDashboardResolver(t *testing.T) {
	t.Run("fetches dashboards from dashboard service", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		exp := int64(14)
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			args.Get(1).(*models.GetDashboardQuery).Result = &models.Dashboard{Id: exp}
		}).Return(nil)
		sut := createDashboardResolverSut(dbs)

		id, err := sut.getId(context.Background(), 1, "dashboard-uid")

		require.NoError(t, err)
		require.Equal(t, exp, id)
	})

	t.Run("fetches dashboardNotFound if underlying dashboard does not exist", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			args.Get(1).(*models.GetDashboardQuery).Result = nil
		}).Return(dashboards.ErrDashboardNotFound)
		sut := createDashboardResolverSut(dbs)

		id, err := sut.getId(context.Background(), 1, "not-exist")

		require.NoError(t, err)
		require.Equal(t, dashboardNotFound, id)
	})
}

func createDashboardResolverSut(dbs *dashboards.FakeDashboardService) *dashboardResolver {
	return newDashboardResolver(dbs, log.NewNopLogger(), 1*time.Nanosecond)
}
