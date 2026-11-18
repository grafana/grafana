package dashboards_test

import (
	"context"
	"math/rand"
	"testing"

	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardstest"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewDashboardIDScopeResolver(&dashboardstest.FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := dashboards.NewDashboardIDScopeResolver(&dashboardstest.FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := dashboards.NewDashboardUIDScopeResolver(&dashboardstest.FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := dashboards.NewDashboardUIDScopeResolver(&dashboardstest.FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}
