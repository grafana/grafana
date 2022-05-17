package searchV2

import (
	"context"
	"flag"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
	"github.com/grafana/grafana/pkg/services/store"

	"github.com/blugelabs/bluge"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"
)

type testDashboardLoader struct {
	dashboards []dashboard
}

func (t *testDashboardLoader) LoadDashboards(_ context.Context, _ int64, _ string) ([]dashboard, error) {
	return t.dashboards, nil
}

var testLogger = log.New("index-test-logger")

var testAllowAllFilter = func(uid string) bool {
	return true
}

var testDisallowAllFilter = func(uid string) bool {
	return false
}

var update = flag.Bool("update", false, "update golden files")

func initTestIndexFromDashes(t *testing.T, dashboards []dashboard) (*dashboardIndex, *bluge.Reader, *bluge.Writer) {
	t.Helper()
	dashboardLoader := &testDashboardLoader{
		dashboards: dashboards,
	}
	index := newDashboardIndex(dashboardLoader, &store.MockEntityEventsService{})
	require.NotNil(t, index)
	numDashboards, err := index.buildOrgIndex(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, len(dashboardLoader.dashboards), numDashboards)
	reader, ok := index.getOrgReader(1)
	require.True(t, ok)
	writer, ok := index.getOrgWriter(1)
	require.True(t, ok)
	return index, reader, writer
}

func checkSearchResponse(t *testing.T, fileName string, reader *bluge.Reader, filter ResourceFilter, query DashboardQuery) {
	t.Helper()
	resp := doSearchQuery(context.Background(), testLogger, reader, filter, query)
	goldenFile := filepath.Join("testdata", fileName)
	err := experimental.CheckGoldenDataResponse(goldenFile, resp, *update)
	require.NoError(t, err)
}

var testDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "test",
		},
	},
	{
		id:  2,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "boom",
		},
	},
}

func TestDashboardIndex(t *testing.T) {
	t.Run("basic-search", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name())+".txt", reader, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("basic-filter", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name())+".txt", reader, testDisallowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})
}

func TestDashboardIndexUpdates(t *testing.T) {
	t.Run("dashboard-delete", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.removeDashboard(writer, reader, "2")
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name())+".txt", newReader, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("dashboard-create", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.updateDashboard(writer, reader, dashboard{
			id:  3,
			uid: "3",
			info: &extract.DashboardInfo{
				Title: "created",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name())+".txt", newReader, testAllowAllFilter,
			DashboardQuery{Query: "created"},
		)
	})

	t.Run("dashboard-update", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.updateDashboard(writer, reader, dashboard{
			id:  2,
			uid: "2",
			info: &extract.DashboardInfo{
				Title: "nginx",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name())+".txt", newReader, testAllowAllFilter,
			DashboardQuery{Query: "nginx"},
		)
	})
}
