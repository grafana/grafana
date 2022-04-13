package searchV2

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

type testDashboardLoader struct {
	dashboards []dashboard
}

func (t *testDashboardLoader) LoadDashboards(ctx context.Context, orgID int64, dashboardID int64) ([]dashboard, error) {
	return t.dashboards, nil
}

func TestDashboardIndex(t *testing.T) {
	dashboardLoader := &testDashboardLoader{
		dashboards: []dashboard{
			{
				id: 1,
			},
		},
	}
	index := NewDashboardIndex(&dummyEventStore{}, dashboardLoader)
	require.NotNil(t, index)
	dashboards, err := index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 1)
	dashboardLoader.dashboards = []dashboard{
		{
			id: 2,
		},
	}
	err = index.applyDashboardEvent(context.Background(), 1, 2, "")
	require.NoError(t, err)
	dashboards, err = index.getDashboards(context.Background(), 1)
	require.NoError(t, err)
	require.Len(t, dashboards, 2)
}
