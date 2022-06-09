package searchV2

import (
	"context"
	"fmt"
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

var testOrgID int64 = 1

func initTestIndexFromDashes(t *testing.T, dashboards []dashboard) (*dashboardIndex, *bluge.Reader, *bluge.Writer) {
	t.Helper()
	return initTestIndexFromDashesExtended(t, dashboards, &NoopDocumentExtender{})
}

func initTestIndexFromDashesExtended(t *testing.T, dashboards []dashboard, extender DocumentExtender) (*dashboardIndex, *bluge.Reader, *bluge.Writer) {
	t.Helper()
	dashboardLoader := &testDashboardLoader{
		dashboards: dashboards,
	}
	index := newDashboardIndex(
		dashboardLoader,
		&store.MockEntityEventsService{},
		extender,
		func(ctx context.Context, folderId int64) (string, error) { return "x", nil })
	require.NotNil(t, index)
	numDashboards, err := index.buildOrgIndex(context.Background(), testOrgID)
	require.NoError(t, err)
	require.Equal(t, len(dashboardLoader.dashboards), numDashboards)
	reader, ok := index.getOrgReader(testOrgID)
	require.True(t, ok)
	writer, ok := index.getOrgWriter(testOrgID)
	require.True(t, ok)
	return index, reader, writer
}

func checkSearchResponse(t *testing.T, fileName string, reader *bluge.Reader, filter ResourceFilter, query DashboardQuery) {
	t.Helper()
	checkSearchResponseExtended(t, fileName, reader, filter, query, &NoopQueryExtender{})
}

func checkSearchResponseExtended(t *testing.T, fileName string, reader *bluge.Reader, filter ResourceFilter, query DashboardQuery, extender QueryExtender) {
	t.Helper()
	resp := doSearchQuery(context.Background(), testLogger, reader, filter, query, extender, "/pfix")
	experimental.CheckGoldenJSONResponse(t, "testdata", fileName, resp, true)
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
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("basic-filter", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testDisallowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})
}

func TestDashboardIndexUpdates(t *testing.T) {
	t.Run("dashboard-delete", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.removeDashboard(context.Background(), writer, reader, "2")
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), newReader, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("dashboard-create", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.updateDashboard(context.Background(), testOrgID, writer, reader, dashboard{
			id:  3,
			uid: "3",
			info: &extract.DashboardInfo{
				Title: "created",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), newReader, testAllowAllFilter,
			DashboardQuery{Query: "created"},
		)
	})

	t.Run("dashboard-update", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, testDashboards)

		newReader, err := index.updateDashboard(context.Background(), testOrgID, writer, reader, dashboard{
			id:  2,
			uid: "2",
			info: &extract.DashboardInfo{
				Title: "nginx",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), newReader, testAllowAllFilter,
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

func (t *testDocumentExtender) GetDashboardExtender(_ int64, _ ...string) ExtendDashboardFunc {
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
				return func(field string, value []byte) {
					if field == "test" {
						if num, err := bluge.DecodeNumericFloat64(value); err == nil {
							testNum.Append(num)
							return
						}
					}
				}
			},
		},
	}

	t.Run("sort-asc", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "test"}, extender.GetQueryExtender(),
		)
	})

	t.Run("sort-desc", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "-test"}, extender.GetQueryExtender(),
		)
	})
}

var testPrefixDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "Archer Data",
		},
	},
	{
		id:  2,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "Document Sync",
		},
	},
}

func TestDashboardIndex_PrefixSearch(t *testing.T) {
	t.Run("prefix-search-beginning", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "Arch"},
		)
	})

	t.Run("prefix-search-middle", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "Syn"},
		)
	})

	t.Run("prefix-search-beginning-lower", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "arch"},
		)
	})

	t.Run("prefix-search-middle-lower", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "syn"},
		)
	})
}

func TestDashboardIndex_MultipleTokensInRow(t *testing.T) {
	t.Run("multiple-tokens-beginning", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "Archer da"},
		)
	})

	t.Run("multiple-tokens-beginning-lower", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "archer da"},
		)
	})

	t.Run("multiple-tokens-middle", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "rcher Da"},
		)
	})

	t.Run("multiple-tokens-middle-lower", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "cument sy"},
		)
	})
}

var longPrefixDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "Eyjafjallajökull Eruption data",
		},
	},
}

func TestDashboardIndex_PrefixNgramExceeded(t *testing.T) {
	t.Run("prefix-search-ngram-exceeded", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, longPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "Eyjafjallajöku"},
		)
	})
}

var scatteredTokensDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "Three can keep a secret, if two of them are dead (Benjamin Franklin)",
		},
	},
	{
		id:  3,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "A secret is powerful when it is empty (Umberto Eco)",
		},
	},
}

func TestDashboardIndex_MultipleTokensScattered(t *testing.T) {
	t.Run("scattered-tokens-match", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, scatteredTokensDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "dead secret"},
		)
	})
	t.Run("scattered-tokens-match-reversed", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, scatteredTokensDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "powerful secret"},
		)
	})
}

var dashboardsWithFolders = []dashboard{
	{
		id:       1,
		uid:      "1",
		isFolder: true,
		info: &extract.DashboardInfo{
			Title: "My folder",
		},
	},
	{
		id:       2,
		uid:      "2",
		folderID: 1,
		info: &extract.DashboardInfo{
			Title: "Dashboard in folder 1",
			Panels: []extract.PanelInfo{
				{
					ID:    1,
					Title: "Panel 1",
				},
				{
					ID:    2,
					Title: "Panel 2",
				},
			},
		},
	},
	{
		id:       3,
		uid:      "3",
		folderID: 1,
		info: &extract.DashboardInfo{
			Title: "Dashboard in folder 2",
			Panels: []extract.PanelInfo{
				{
					ID:    3,
					Title: "Panel 3",
				},
			},
		},
	},
	{
		id:  4,
		uid: "4",
		info: &extract.DashboardInfo{
			Title: "One more dash",
			Panels: []extract.PanelInfo{
				{
					ID:    3,
					Title: "Panel 4",
				},
			},
		},
	},
}

func TestDashboardIndex_Folders(t *testing.T) {
	t.Run("folders-indexed", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, dashboardsWithFolders)
		checkSearchResponse(t, filepath.Base(t.Name()), reader, testAllowAllFilter,
			DashboardQuery{Query: "My folder", Kind: []string{string(entityKindFolder)}},
		)
	})
	t.Run("folders-dashboard-has-folder", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, dashboardsWithFolders)
		// TODO: golden file compare does not work here.
		resp := doSearchQuery(context.Background(), testLogger, reader, testAllowAllFilter,
			DashboardQuery{Query: "Dashboard in folder", Kind: []string{string(entityKindDashboard)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.Equal(t, uint64(2), custom.Count)
		require.True(t, ok, fmt.Sprintf("actual type: %T", resp.Frames[0].Meta.Custom))
		require.Equal(t, "/dashboards/f/1/", custom.Locations["1"].URL)
	})
	t.Run("folders-dashboard-removed-on-folder-removed", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, dashboardsWithFolders)
		newReader, err := index.removeFolder(context.Background(), writer, reader, "1")
		require.NoError(t, err)
		// In response we expect one dashboard which does not belong to removed folder.
		checkSearchResponse(t, filepath.Base(t.Name()), newReader, testAllowAllFilter,
			DashboardQuery{Query: "dash", Kind: []string{string(entityKindDashboard)}},
		)
	})
	t.Run("folders-panels-removed-on-folder-removed", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, dashboardsWithFolders)
		newReader, err := index.removeFolder(context.Background(), writer, reader, "1")
		require.NoError(t, err)
		resp := doSearchQuery(context.Background(), testLogger, newReader, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.True(t, ok)
		require.Equal(t, uint64(1), custom.Count) // 1 panel which does not belong to dashboards in removed folder.
	})
}

var dashboardsWithPanels = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "My Dash",
			Panels: []extract.PanelInfo{
				{
					ID:    1,
					Title: "Panel 1",
				},
				{
					ID:    2,
					Title: "Panel 2",
				},
			},
		},
	},
}

func TestDashboardIndex_Panels(t *testing.T) {
	t.Run("panels-indexed", func(t *testing.T) {
		_, reader, _ := initTestIndexFromDashes(t, dashboardsWithPanels)
		// TODO: golden file compare does not work here.
		resp := doSearchQuery(
			context.Background(), testLogger, reader, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.True(t, ok, fmt.Sprintf("actual type: %T", resp.Frames[0].Meta.Custom))
		require.Equal(t, uint64(2), custom.Count)
		require.Equal(t, "/d/1/", custom.Locations["1"].URL)
	})
	t.Run("panels-panel-removed-on-dashboard-removed", func(t *testing.T) {
		index, reader, writer := initTestIndexFromDashes(t, dashboardsWithPanels)
		newReader, err := index.removeDashboard(context.Background(), writer, reader, "1")
		require.NoError(t, err)
		checkSearchResponse(t, filepath.Base(t.Name()), newReader, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
		)
	})
}
