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

func initTestIndexFromDashes(t *testing.T, dashboards []dashboard) *bluge.Reader {
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
	return reader
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
		reader := initTestIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name())+".txt", reader, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("basic-filter", func(t *testing.T) {
		reader := initTestIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name())+".txt", reader, testDisallowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})
}
