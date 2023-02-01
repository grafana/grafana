package historian

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/dashboards"
)

func TestDashboardResolver(t *testing.T) {
	t.Run("fetches dashboards from dashboard service", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		exp := int64(14)
		result := &dashboards.Dashboard{ID: exp}
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(result, nil)
		sut := createDashboardResolverSut(dbs)

		id, err := sut.getID(context.Background(), 1, "dashboard-uid")

		require.NoError(t, err)
		require.Equal(t, exp, id)
	})

	t.Run("fetches dashboardNotFound if underlying dashboard does not exist", func(t *testing.T) {
		dbs := &dashboards.FakeDashboardService{}
		dbs.On("GetDashboard", mock.Anything, mock.Anything).Return(nil, dashboards.ErrDashboardNotFound)
		sut := createDashboardResolverSut(dbs)

		_, err := sut.getID(context.Background(), 1, "not-exist")

		require.Error(t, err)
		require.ErrorIs(t, err, dashboards.ErrDashboardNotFound)
	})
}

func createDashboardResolverSut(dbs *dashboards.FakeDashboardService) *dashboardResolver {
	return newDashboardResolver(dbs, 1*time.Nanosecond)
}
