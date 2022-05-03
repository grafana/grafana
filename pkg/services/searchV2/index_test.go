package searchV2

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/services/store"
	"github.com/stretchr/testify/require"
)

type testDashboardLoader struct {
	dashboards []dashboard
}

func (t *testDashboardLoader) LoadDashboards(ctx context.Context, orgID int64, dashboardUID string) ([]dashboard, error) {
	return t.dashboards, nil
}

func TestDashboardIndexCreate(t *testing.T) {
	dashboardLoader := &testDashboardLoader{
		dashboards: []dashboard{
			{
				uid: "1",
			},
		},
	}
	index := newDashboardIndex(dashboardLoader, &store.MockEntityEventsService{})
	require.NotNil(t, index)
	dashboards, err := index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 1)

	dashboardLoader.dashboards = []dashboard{
		{
			uid: "2",
		},
	}
	err = index.applyDashboardEvent(context.Background(), 1, "2", "")
	require.NoError(t, err)
	dashboards, err = index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 2)
}

func TestDashboardIndexUpdate(t *testing.T) {
	dashboardLoader := &testDashboardLoader{
		dashboards: []dashboard{
			{
				uid:  "1",
				slug: "test",
			},
		},
	}
	index := newDashboardIndex(dashboardLoader, nil)
	require.NotNil(t, index)
	dashboards, err := index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 1)

	dashboardLoader.dashboards = []dashboard{
		{
			uid:  "1",
			slug: "updated",
		},
	}
	err = index.applyDashboardEvent(context.Background(), 1, "1", "")
	require.NoError(t, err)
	dashboards, err = index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 1)
	require.Equal(t, "updated", dashboards[0].slug)
}

func TestDashboardIndexDelete(t *testing.T) {
	dashboardLoader := &testDashboardLoader{
		dashboards: []dashboard{
			{
				uid: "1",
			},
		},
	}
	index := newDashboardIndex(dashboardLoader, nil)
	require.NotNil(t, index)
	dashboards, err := index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 1)

	dashboardLoader.dashboards = []dashboard{}
	err = index.applyDashboardEvent(context.Background(), 1, "1", "")
	require.NoError(t, err)
	dashboards, err = index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 0)
}
