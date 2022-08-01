package searchV2

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/blugelabs/bluge"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/searchV2/extract"
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

func initDashboardIndexFromDashes(t *testing.T, dashboards []dashboard) *dashboardIndex {
	t.Helper()
	return initTestIndexFromDashesExtended(t, testOrgID, dashboards, &NoopDocumentExtender{})
}

func initDashboardIndexFromDashesExtended(t *testing.T, dashboards []dashboard, extender DocumentExtender) *dashboardIndex {
	t.Helper()
	return initTestIndexFromDashesExtended(t, testOrgID, dashboards, extender)
}

func initTestIndexFromDashes(t *testing.T, dashboards []dashboard) *dashboardIndex {
	t.Helper()
	return initTestIndexFromDashesExtended(t, testOrgID, dashboards, &NoopDocumentExtender{})
}

func initTestIndexFromDashesExtended(t *testing.T, orgID int64, dashboards []dashboard, extender DocumentExtender) *dashboardIndex {
	t.Helper()
	dashboardLoader := &testDashboardLoader{
		dashboards: dashboards,
	}
	index, err := createDashboardIndex(
		context.Background(),
		orgID,
		nil,
		dashboardLoader,
		extender,
		func(ctx context.Context, folderId int64) (string, error) { return "x", nil },
		0, 0,
	)
	require.NoError(t, err)
	require.NotNil(t, index)
	return index
}

func checkSearchResponse(t *testing.T, fileName string, index *dashboardIndex, filter ResourceFilter, query DashboardQuery) {
	t.Helper()
	checkSearchResponseExtended(t, fileName, index, filter, query, &NoopQueryExtender{})
}

func checkSearchResponseExtended(t *testing.T, fileName string, index *dashboardIndex, filter ResourceFilter, query DashboardQuery, extender QueryExtender) {
	t.Helper()
	reader, cancel, err := index.Reader()
	require.NoError(t, err)
	defer cancel()
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
		index := initDashboardIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("basic-filter", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testDisallowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})
}

func TestDashboardIndexUpdates(t *testing.T) {
	t.Run("dashboard-delete", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		err := index.removeDashboard(context.Background(), "2")
		require.NoError(t, err)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("dashboard-create", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		err := index.updateDashboard(context.Background(), dashboard{
			id:  3,
			uid: "3",
			info: &extract.DashboardInfo{
				Title: "created",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "created"},
		)
	})

	t.Run("dashboard-update", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		err := index.updateDashboard(context.Background(), dashboard{
			id:  2,
			uid: "2",
			info: &extract.DashboardInfo{
				Title: "nginx",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
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
		index := initDashboardIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "test"}, extender.GetQueryExtender(),
		)
	})

	t.Run("sort-desc", func(t *testing.T) {
		index := initDashboardIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "-test"}, extender.GetQueryExtender(),
		)
	})
}

var testPrefixDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "Archer Data System",
		},
	},
	{
		id:  2,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "Document Sync repo",
		},
	},
}

func TestDashboardIndex_PrefixSearch(t *testing.T) {
	t.Run("prefix-search-beginning", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Arch"},
		)
	})

	t.Run("prefix-search-middle", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Syn"},
		)
	})

	t.Run("prefix-search-beginning-lower", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "arch"},
		)
	})

	t.Run("prefix-search-middle-lower", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "syn"},
		)
	})
}

func TestDashboardIndex_MultipleTokensInRow(t *testing.T) {
	t.Run("multiple-tokens-beginning", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Archer da"},
		)
	})

	t.Run("multiple-tokens-beginning-lower", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "da archer"},
		)
	})

	// Not sure it is great this matches, but
	t.Run("multiple-tokens-middle", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "ar Da"},
		)
	})

	t.Run("multiple-tokens-middle-lower", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "doc sy"},
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
		index := initDashboardIndexFromDashes(t, longPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
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
		index := initDashboardIndexFromDashes(t, scatteredTokensDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "dead secret"},
		)
	})
	t.Run("scattered-tokens-match-reversed", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, scatteredTokensDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
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
		index := initDashboardIndexFromDashes(t, dashboardsWithFolders)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "My folder", Kind: []string{string(entityKindFolder)}},
		)
	})
	t.Run("folders-dashboard-has-folder", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, dashboardsWithFolders)
		// TODO: golden file compare does not work here.
		reader, cancel, err := index.Reader()
		require.NoError(t, err)
		defer cancel()
		resp := doSearchQuery(context.Background(), testLogger, reader, testAllowAllFilter,
			DashboardQuery{Query: "Dashboard in folder", Kind: []string{string(entityKindDashboard)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.Equal(t, uint64(2), custom.Count)
		require.True(t, ok, fmt.Sprintf("actual type: %T", resp.Frames[0].Meta.Custom))
		require.Equal(t, "/dashboards/f/1/", custom.Locations["1"].URL)
	})
	t.Run("folders-dashboard-removed-on-folder-removed", func(t *testing.T) {
		index := initTestIndexFromDashes(t, dashboardsWithFolders)
		err := index.removeFolder(context.Background(), "1")
		require.NoError(t, err)
		// Inside a response we expect one dashboard which does not belong to removed folder.
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "dash", Kind: []string{string(entityKindDashboard)}},
		)
	})
	t.Run("folders-panels-removed-on-folder-removed", func(t *testing.T) {
		index := initTestIndexFromDashes(t, dashboardsWithFolders)
		err := index.removeFolder(context.Background(), "1")
		require.NoError(t, err)
		reader, cancel, err := index.Reader()
		require.NoError(t, err)
		defer cancel()
		resp := doSearchQuery(context.Background(), testLogger, reader, testAllowAllFilter,
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
		index := initDashboardIndexFromDashes(t, dashboardsWithPanels)
		// TODO: golden file compare does not work here.
		reader, cancel, err := index.Reader()
		require.NoError(t, err)
		defer cancel()
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
		index := initTestIndexFromDashes(t, dashboardsWithPanels)
		err := index.removeDashboard(context.Background(), "1")
		require.NoError(t, err)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
		)
	})
}

var punctuationSplitNgramDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "heat-torkel",
		},
	},
	{
		id:  2,
		uid: "2",
		info: &extract.DashboardInfo{
			Title: "topology heatmap",
		},
	},
}

func TestDashboardIndex_PunctuationNgram(t *testing.T) {
	t.Run("ngram-punctuation-split", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, punctuationSplitNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "tork he"},
		)
	})

	t.Run("ngram-simple", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, punctuationSplitNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "hea"},
		)
	})
}

var camelCaseNgramDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "heatTorkel",
		},
	},
}

func TestDashboardIndex_CamelCaseNgram(t *testing.T) {
	t.Run("ngram-camel-case-split", func(t *testing.T) {
		index := initDashboardIndexFromDashes(t, camelCaseNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "tork"},
		)
	})
}

var reindexCheckInitialDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		info: &extract.DashboardInfo{
			Title: "dash1",
		},
		updated: time.Date(2022, 10, 1, 21, 0, 0, 0, time.UTC),
	},
}

func TestDashboardIndex_DashboardsDiffer(t *testing.T) {
	// Same dashboards.
	require.False(t, dashboardsDiffer(reindexCheckInitialDashboards, []indexedDashboard{
		{
			UID:     "1",
			Updated: time.Date(2022, 10, 1, 21, 0, 0, 0, time.UTC),
		},
	}))

	// Updated changed.
	require.True(t, dashboardsDiffer(reindexCheckInitialDashboards, []indexedDashboard{
		{
			UID:     "1",
			Updated: time.Date(2022, 10, 1, 23, 0, 0, 0, time.UTC),
		},
	}))

	// Same size, different uid.
	require.True(t, dashboardsDiffer(reindexCheckInitialDashboards, []indexedDashboard{
		{
			UID:     "2",
			Updated: time.Date(2022, 10, 1, 21, 0, 0, 0, time.UTC),
		},
	}))

	// Dashboard removed.
	require.True(t, dashboardsDiffer(reindexCheckInitialDashboards, []indexedDashboard{}))

	// Dashboard added.
	require.True(t, dashboardsDiffer(reindexCheckInitialDashboards, []indexedDashboard{
		{
			UID:     "1",
			Updated: time.Date(2022, 10, 1, 21, 0, 0, 0, time.UTC),
		},
		{
			UID:     "2",
			Updated: time.Date(2022, 10, 1, 21, 0, 0, 0, time.UTC),
		},
	}))
}
