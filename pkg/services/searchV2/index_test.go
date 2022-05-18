package searchV2

import (
	"context"
	"flag"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"

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
	return initTestIndexFromDashesExtended(t, dashboards, &NoopDocumentExtender{})
}

func initTestIndexFromDashesExtended(t *testing.T, dashboards []dashboard, extender DocumentExtender) (*dashboardIndex, *bluge.Reader, *bluge.Writer) {
	t.Helper()
	dashboardLoader := &testDashboardLoader{
		dashboards: dashboards,
	}
	index := newDashboardIndex(dashboardLoader, &store.MockEntityEventsService{}, extender)
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
	checkSearchResponseExtended(t, fileName, reader, filter, query, &NoopQueryExtender{})
}

func checkSearchResponseExtended(t *testing.T, fileName string, reader *bluge.Reader, filter ResourceFilter, query DashboardQuery, extender QueryExtender) {
	t.Helper()
	resp := doSearchQuery(context.Background(), testLogger, reader, filter, query, extender)
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

var testSortDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "a-test",
		},
	},
	{
		id:  2,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "z-test",
		},
	},
}

type testExtender struct {
	documentExtender DocumentExtender
	queryExtender    QueryExtender
}

func (t *testExtender) GetDocumentExtender() DocumentExtender {
	return t.documentExtender
}

func (t *testExtender) GetQueryExtender() QueryExtender {
	return t.queryExtender
}

type testDocumentExtender struct {
	ExtendDashboardFunc ExtendDashboardFunc
}

func (t *testDocumentExtender) GetDashboardExtender(_ int64, _ []string) ExtendDashboardFunc {
	return t.ExtendDashboardFunc
}

type testQueryExtender struct {
	getFramer func(frame *data.Frame) FramerFunc
}

func (t *testQueryExtender) GetFramer(frame *data.Frame) FramerFunc {
	return t.getFramer(frame)
}

func TestDashboardIndexSort(t *testing.T) {
	var i float64
	extender := &testExtender{
		documentExtender: &testDocumentExtender{
			ExtendDashboardFunc: func(uid string, doc *bluge.Document) error {
				doc.AddField(bluge.NewNumericField("test", i).StoreValue().Sortable())
				i++
				return nil
			},
		},
		queryExtender: &testQueryExtender{
			getFramer: func(frame *data.Frame) FramerFunc {
				testNum := data.NewFieldFromFieldType(data.FieldTypeFloat64, 0)
				testNum.Name = "test num"
				frame.Fields = append(
					frame.Fields,
					testNum,
				)
				return func(field string, value []byte) bool {
					if field == "test" {
						if num, err := bluge.DecodeNumericFloat64(value); err == nil {
							testNum.Append(num)
							return true
						}
					}
					return true
				}
			},
		},
	}

	t.Run("sort-asc", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name())+".txt", reader, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "test"}, extender.GetQueryExtender(),
		)
	})

	t.Run("sort-desc", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name())+".txt", reader, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "-test"}, extender.GetQueryExtender(),
		)
	})
}
