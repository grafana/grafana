package searchV2

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/blugelabs/bluge"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/dashboards/database"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/services/quota/quotatest"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/store"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type testDashboardLoader struct {
	dashboards []dashboard
}

func (t *testDashboardLoader) LoadDashboards(_ context.Context, _ int64, _ string) ([]dashboard, error) {
	return t.dashboards, nil
}

var testLogger = log.New("index-test-logger")

var testAllowAllFilter = func(kind entityKind, uid, parent string) bool {
	return true
}

var testDisallowAllFilter = func(kind entityKind, uid, parent string) bool {
	return false
}

var testOrgID int64 = 1

func initTestOrgIndexFromDashes(t *testing.T, dashboards []dashboard) *orgIndex {
	t.Helper()
	searchIdx := initTestIndexFromDashesExtended(t, dashboards, &NoopDocumentExtender{})
	return searchIdx.perOrgIndex[testOrgID]
}

func initTestOrgIndexFromDashesExtended(t *testing.T, dashboards []dashboard, extender DocumentExtender) *orgIndex {
	t.Helper()
	searchIdx := initTestIndexFromDashesExtended(t, dashboards, extender)
	return searchIdx.perOrgIndex[testOrgID]
}

func initTestIndexFromDashes(t *testing.T, dashboards []dashboard) *searchIndex {
	t.Helper()
	return initTestIndexFromDashesExtended(t, dashboards, &NoopDocumentExtender{})
}

func initTestIndexFromDashesExtended(t *testing.T, dashboards []dashboard, extender DocumentExtender) *searchIndex {
	t.Helper()
	dashboardLoader := &testDashboardLoader{
		dashboards: dashboards,
	}
	index := newSearchIndex(dashboardLoader, &store.MockEntityEventsService{}, extender, func(ctx context.Context, folderId int64) (string, error) { return "x", nil }, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures(), setting.SearchSettings{})
	require.NotNil(t, index)
	numDashboards, err := index.buildOrgIndex(context.Background(), testOrgID)
	require.NoError(t, err)
	require.Equal(t, len(dashboardLoader.dashboards), numDashboards)
	return index
}

func checkSearchResponse(t *testing.T, fileName string, index *orgIndex, filter ResourceFilter, query DashboardQuery) {
	t.Helper()
	checkSearchResponseExtended(t, fileName, index, filter, query, &NoopQueryExtender{})
}

func checkSearchResponseExtended(t *testing.T, fileName string, index *orgIndex, filter ResourceFilter, query DashboardQuery, extender QueryExtender) {
	t.Helper()
	resp := doSearchQuery(context.Background(), testLogger, index, filter, query, extender, "/pfix")
	experimental.CheckGoldenJSONResponse(t, "testdata", fileName, resp, true)
}

func getFrameWithNames(resp *backend.DataResponse) *data.Frame {
	if resp == nil || len(resp.Frames) == 0 {
		return nil
	}

	frame := resp.Frames[0]
	nameField, idx := frame.FieldByName(documentFieldName)
	if nameField.Len() == 0 || idx == -1 {
		return nil
	}

	scoreField, _ := frame.FieldByName("score")
	return data.NewFrame("ordering frame", nameField, scoreField)
}

func checkSearchResponseOrdering(t *testing.T, fileName string, index *orgIndex, filter ResourceFilter, query DashboardQuery) {
	t.Helper()
	checkSearchResponseOrderingExtended(t, fileName, index, filter, query, &NoopQueryExtender{})
}

func checkSearchResponseOrderingExtended(t *testing.T, fileName string, index *orgIndex, filter ResourceFilter, query DashboardQuery, extender QueryExtender) {
	t.Helper()
	query.Explain = true
	resp := doSearchQuery(context.Background(), testLogger, index, filter, query, extender, "/pfix")
	experimental.CheckGoldenJSONFrame(t, "testdata", fileName, getFrameWithNames(resp), true)
}

var testDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "test",
		},
	},
	{
		id:  2,
		uid: "2",
		summary: &entity.EntitySummary{
			Name: "boom",
		},
	},
}

func TestDashboardIndex(t *testing.T) {
	t.Run("basic-search", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("basic-filter", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testDisallowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})
}

func TestDashboardIndexUpdates(t *testing.T) {
	t.Run("dashboard-delete", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)
		err := index.removeDashboard(context.Background(), orgIdx, "2")
		require.NoError(t, err)
		checkSearchResponse(t, filepath.Base(t.Name()), orgIdx, testAllowAllFilter,
			DashboardQuery{Query: "boom"},
		)
	})

	t.Run("dashboard-create", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)

		err := index.updateDashboard(context.Background(), testOrgID, orgIdx, dashboard{
			id:  3,
			uid: "3",
			summary: &entity.EntitySummary{
				Name: "created",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), orgIdx, testAllowAllFilter,
			DashboardQuery{Query: "created"},
		)
	})

	t.Run("dashboard-update", func(t *testing.T) {
		index := initTestIndexFromDashes(t, testDashboards)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)

		err := index.updateDashboard(context.Background(), testOrgID, orgIdx, dashboard{
			id:  2,
			uid: "2",
			summary: &entity.EntitySummary{
				Name: "nginx",
			},
		})
		require.NoError(t, err)

		checkSearchResponse(t, filepath.Base(t.Name()), orgIdx, testAllowAllFilter,
			DashboardQuery{Query: "nginx"},
		)
	})
}

var testSortDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "a-test",
		},
	},
	{
		id:  2,
		uid: "2",
		summary: &entity.EntitySummary{
			Name: "z-test",
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
		index := initTestOrgIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "test"}, extender.GetQueryExtender(),
		)
	})

	t.Run("sort-desc", func(t *testing.T) {
		index := initTestOrgIndexFromDashesExtended(t, testSortDashboards, extender.GetDocumentExtender())
		checkSearchResponseExtended(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "*", Sort: "-test"}, extender.GetQueryExtender(),
		)
	})
}

var testPrefixDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "Archer Data System",
		},
	},
	{
		id:  2,
		uid: "2",
		summary: &entity.EntitySummary{
			Name: "Document Sync repo",
		},
	},
}

func TestDashboardIndex_PrefixSearch(t *testing.T) {
	t.Run("prefix-search-beginning", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Arch"},
		)
	})

	t.Run("prefix-search-middle", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Syn"},
		)
	})

	t.Run("prefix-search-beginning-lower", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "arch"},
		)
	})

	t.Run("prefix-search-middle-lower", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "syn"},
		)
	})
}

func TestDashboardIndex_MultipleTokensInRow(t *testing.T) {
	t.Run("multiple-tokens-beginning", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Archer da"},
		)
	})

	t.Run("multiple-tokens-beginning-lower", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "da archer"},
		)
	})

	// Not sure it is great this matches, but
	t.Run("multiple-tokens-middle", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "ar Da"},
		)
	})

	t.Run("multiple-tokens-middle-lower", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, testPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "doc sy"},
		)
	})
}

var longPrefixDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "Eyjafjallajökull Eruption data",
		},
	},
}

func TestDashboardIndex_PrefixNgramExceeded(t *testing.T) {
	t.Run("prefix-search-ngram-exceeded", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, longPrefixDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "Eyjafjallajöku"},
		)
	})
}

var scatteredTokensDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "Three can keep a secret, if two of them are dead (Benjamin Franklin)",
		},
	},
	{
		id:  3,
		uid: "2",
		summary: &entity.EntitySummary{
			Name: "A secret is powerful when it is empty (Umberto Eco)",
		},
	},
}

func TestDashboardIndex_MultipleTokensScattered(t *testing.T) {
	t.Run("scattered-tokens-match", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, scatteredTokensDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "dead secret"},
		)
	})
	t.Run("scattered-tokens-match-reversed", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, scatteredTokensDashboards)
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
		summary: &entity.EntitySummary{
			Name: "My folder",
		},
	},
	{
		id:       2,
		uid:      "2",
		folderID: 1,
		summary: &entity.EntitySummary{
			Name: "Dashboard in folder 1",
			Nested: []*entity.EntitySummary{
				newNestedPanel(1, 2, "Panel 1"),
				newNestedPanel(2, 2, "Panel 2"),
			},
		},
	},
	{
		id:       3,
		uid:      "3",
		folderID: 1,
		summary: &entity.EntitySummary{
			Name: "Dashboard in folder 2",
			Nested: []*entity.EntitySummary{
				newNestedPanel(3, 3, "Panel 3"),
			},
		},
	},
	{
		id:  4,
		uid: "4",
		summary: &entity.EntitySummary{
			Name: "One more dash",
			Nested: []*entity.EntitySummary{
				newNestedPanel(4, 4, "Panel 4"),
			},
		},
	},
}

func TestDashboardIndex_Folders(t *testing.T) {
	t.Run("folders-indexed", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, dashboardsWithFolders)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "My folder", Kind: []string{string(entityKindFolder)}},
		)
	})
	t.Run("folders-dashboard-has-folder", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, dashboardsWithFolders)
		// TODO: golden file compare does not work here.
		resp := doSearchQuery(context.Background(), testLogger, index, testAllowAllFilter,
			DashboardQuery{Query: "Dashboard in folder", Kind: []string{string(entityKindDashboard)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.Equal(t, uint64(2), custom.Count)
		require.True(t, ok, fmt.Sprintf("actual type: %T", resp.Frames[0].Meta.Custom))
		require.Equal(t, "/dashboards/f/1/", custom.Locations["1"].URL)
	})
	t.Run("folders-dashboard-removed-on-folder-removed", func(t *testing.T) {
		index := initTestIndexFromDashes(t, dashboardsWithFolders)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)
		err := index.removeFolder(context.Background(), orgIdx, "1")
		require.NoError(t, err)
		// In response we expect one dashboard which does not belong to removed folder.
		checkSearchResponse(t, filepath.Base(t.Name()), orgIdx, testAllowAllFilter,
			DashboardQuery{Query: "dash", Kind: []string{string(entityKindDashboard)}},
		)
	})
	t.Run("folders-panels-removed-on-folder-removed", func(t *testing.T) {
		index := initTestIndexFromDashes(t, dashboardsWithFolders)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)
		err := index.removeFolder(context.Background(), orgIdx, "1")
		require.NoError(t, err)
		resp := doSearchQuery(context.Background(), testLogger, orgIdx, testAllowAllFilter,
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
		summary: &entity.EntitySummary{
			Name: "My Dash",
			Nested: []*entity.EntitySummary{
				newNestedPanel(1, 1, "Panel 1"),
				newNestedPanel(2, 1, "Panel 2"),
			},
		},
	},
}

func newNestedPanel(id, dashId int64, name string) *entity.EntitySummary {
	summary := &entity.EntitySummary{
		Kind: "panel",
		UID:  fmt.Sprintf("%d#%d", dashId, id),
	}
	summary.Name = name
	return summary
}

func TestDashboardIndex_Panels(t *testing.T) {
	t.Run("panels-indexed", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, dashboardsWithPanels)
		// TODO: golden file compare does not work here.
		resp := doSearchQuery(
			context.Background(), testLogger, index, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
			&NoopQueryExtender{}, "")
		custom, ok := resp.Frames[0].Meta.Custom.(*customMeta)
		require.True(t, ok, fmt.Sprintf("actual type: %T", resp.Frames[0].Meta.Custom))
		require.Equal(t, uint64(2), custom.Count)
		require.Equal(t, "/d/1/", custom.Locations["1"].URL)
	})
	t.Run("panels-panel-removed-on-dashboard-removed", func(t *testing.T) {
		index := initTestIndexFromDashes(t, dashboardsWithPanels)
		orgIdx, ok := index.getOrgIndex(testOrgID)
		require.True(t, ok)
		err := index.removeDashboard(context.Background(), orgIdx, "1")
		require.NoError(t, err)
		checkSearchResponse(t, filepath.Base(t.Name()), orgIdx, testAllowAllFilter,
			DashboardQuery{Query: "Panel", Kind: []string{string(entityKindPanel)}},
		)
	})
}

var punctuationSplitNgramDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "heat-torkel",
		},
	},
	{
		id:  2,
		uid: "2",
		summary: &entity.EntitySummary{
			Name: "topology heatmap",
		},
	},
}

func TestDashboardIndex_PunctuationNgram(t *testing.T) {
	t.Run("ngram-punctuation-split", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, punctuationSplitNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "tork he"},
		)
	})

	t.Run("ngram-simple", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, punctuationSplitNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "hea"},
		)
	})
}

var camelCaseNgramDashboards = []dashboard{
	{
		id:  1,
		uid: "1",
		summary: &entity.EntitySummary{
			Name: "heatTorkel",
		},
	},
}

func TestDashboardIndex_CamelCaseNgram(t *testing.T) {
	t.Run("ngram-camel-case-split", func(t *testing.T) {
		index := initTestOrgIndexFromDashes(t, camelCaseNgramDashboards)
		checkSearchResponse(t, filepath.Base(t.Name()), index, testAllowAllFilter,
			DashboardQuery{Query: "tork"},
		)
	})
}

func dashboardsWithTitles(names ...string) []dashboard {
	out := make([]dashboard, 0)
	for i, name := range names {
		no := int64(i + 1)
		out = append(out, dashboard{
			id:  no,
			uid: fmt.Sprintf("%d", no),
			summary: &entity.EntitySummary{
				Name: name,
			},
		})
	}

	return out
}

func TestDashboardIndex_MultiTermPrefixMatch(t *testing.T) {
	var tests = []struct {
		dashboards []dashboard
		query      string
	}{
		{
			dashboards: dashboardsWithTitles(
				"Panel Tests - Bar Gauge 2",
				"Prometheus 2.0",
				"Prometheus 2.0 Stats",
				"Prometheus 20.0",
				"Prometheus Second Word",
				"Prometheus Stats",
				"dynamic (2)",
				"prometheus histogram",
				"prometheus histogram2",
				"roci-simple-2",
				"x not y",
			),
			query: "Prometheus 2.",
		},
		{
			dashboards: dashboardsWithTitles(
				"From AAA",
				"Grafana Dev Overview & Home",
				"Home automation",
				"Prometheus 2.0",
				"Prometheus 2.0 Stats",
				"Prometheus 20.0",
				"Prometheus Stats",
				"Transforms - config from query",
				"iot-testing",
				"prom style with exemplars",
				"prop history",
				"simple frame",
				"with-hide-from",
				"xy broke",
			),
			query: "Prome",
		},
		{
			dashboards: dashboardsWithTitles(
				"Panel Tests - Bar Gauge 2",
				"Prometheus 2.0",
				"Prometheus 2.0 Stats",
				"Prometheus 20.0",
				"Prometheus Second Word",
				"Prometheus Stats",
				"dynamic (2)",
				"prometheus histogram",
				"prometheus histogram2",
				"roci-simple-2",
				"x not y",
			),
			query: "Prometheus stat",
		},
		{
			dashboards: dashboardsWithTitles(
				"Loki Tests - Bar Gauge 2",
				"Loki 2.0",
				"Loki 2.0 Stats",
				"Loki 20.0",
				"Loki Second Word",
				"Loki Stats",
				"dynamic (2)",
				"Loki histogram",
				"Loki histogram2",
				"roci-simple-2",
				"x not y",
			),
			query: "Loki 2.",
		},
		{
			dashboards: dashboardsWithTitles(
				"Loki Tests - Bar Gauge 2",
				"Loki 2.0",
				"Loki 2.0 Stats",
				"Loki 20.0",
				"Loki Second Word",
				"Loki Stats",
				"dynamic (2)",
				"Loki histogram",
				"Loki histogram2",
				"roci-simple-2",
				"x not y",
			),
			query: "Lok",
		},
		{
			dashboards: dashboardsWithTitles(
				"Loki Tests - Bar Gauge 2",
				"Loki 2.0",
				"Loki 2.0 Stats",
				"Loki 20.0",
				"Loki Second Word",
				"Loki Stats",
				"dynamic (2)",
				"Loki histogram",
				"Loki histogram2",
				"roci-simple-2",
				"x not y",
			),
			query: "Loki stats",
		},
	}

	for i, tt := range tests {
		t.Run(fmt.Sprintf("ordering-tests-%d-[%s]", i+1, tt.query), func(t *testing.T) {
			index := initTestOrgIndexFromDashes(t, tt.dashboards)
			checkSearchResponseOrdering(t, filepath.Base(t.Name()), index, testAllowAllFilter,
				DashboardQuery{Query: tt.query},
			)
		})
	}
}

func setupIntegrationEnv(t *testing.T, folderCount, dashboardsPerFolder int, sqlStore *sqlstore.SQLStore) (*StandardSearchService, *user.SignedInUser, error) {
	err := populateDB(folderCount, dashboardsPerFolder, sqlStore)
	require.NoError(t, err, "error when populating the database for integration test")

	// load all dashboards and folders
	dbLoadingBatchSize := (dashboardsPerFolder + 1) * folderCount
	cfg := &setting.Cfg{Search: setting.SearchSettings{DashboardLoadingBatchSize: dbLoadingBatchSize}}
	features := featuremgmt.WithFeatures()
	orgSvc := &orgtest.FakeOrgService{
		ExpectedOrgs: []*org.OrgDTO{{ID: 1}},
	}
	searchService, ok := ProvideService(cfg, sqlStore, store.NewDummyEntityEventsService(), actest.FakeService{},
		tracing.InitializeTracerForTest(), features, orgSvc, nil, folder.NewFakeStore()).(*StandardSearchService)
	require.True(t, ok)

	err = runSearchService(searchService)
	require.NoError(t, err, "error when running search service for integration test")

	user := getSignedInUser(folderCount, dashboardsPerFolder)

	return searchService, user, nil
}

func TestIntegrationSoftDeletion(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	// Set up search v2.
	folderCount := 1
	dashboardsPerFolder := 1
	sqlStore, cfg := db.InitTestDBWithCfg(t)
	searchService, testUser, err := setupIntegrationEnv(t, folderCount, dashboardsPerFolder, sqlStore)
	require.NoError(t, err)

	// Query search v2 to ensure "dashboard2" is present.
	result := searchService.doDashboardQuery(context.Background(), testUser, 1, DashboardQuery{Kind: []string{string(entityKindDashboard)}})
	require.NoError(t, result.Error)
	require.NotZero(t, len(result.Frames))
	for _, field := range result.Frames[0].Fields {
		if field.Name == "uid" {
			require.Equal(t, dashboardsPerFolder, field.Len())
			break
		}
	}

	// Set up dashboard store.
	quotaService := quotatest.New(false, nil)
	featureToggles := featuremgmt.WithFeatures(
		featuremgmt.FlagPanelTitleSearch,
		featuremgmt.FlagDashboardRestore,
	)
	dashboardStore, err := database.ProvideDashboardStore(sqlStore, cfg, featureToggles, tagimpl.ProvideService(sqlStore), quotaService)
	require.NoError(t, err)

	// Soft delete "dashboard2".
	err = dashboardStore.SoftDeleteDashboard(context.Background(), 1, "dashboard2")
	require.NoError(t, err)

	// Reindex to ensure "dashboard2" is excluded from the index.
	searchService.dashboardIndex.reIndexFromScratch(context.Background())

	// Query search v2 to ensure "dashboard2" is no longer present.
	expectedResultCount := dashboardsPerFolder - 1
	result2 := searchService.doDashboardQuery(context.Background(), testUser, 1, DashboardQuery{Kind: []string{string(entityKindDashboard)}})
	require.NoError(t, result2.Error)
	require.NotZero(t, len(result2.Frames))
	for _, field := range result2.Frames[0].Fields {
		if field.Name == "uid" {
			require.Equal(t, expectedResultCount, field.Len())
			break
		}
	}
}
