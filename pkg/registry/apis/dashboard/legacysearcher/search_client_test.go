package legacysearcher

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/selection"

	dashboard "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unisearch "github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestDashboardSearchClient_Search(t *testing.T) {
	mockStore := dashboards.NewFakeDashboardStore(t)
	sortSvc := sort.ProvideService()
	client := NewDashboardSearchClient(mockStore, sortSvc)
	ctx := context.Background()
	user := &user.SignedInUser{OrgID: 2}
	ctx = identity.WithRequester(ctx, user)
	emptyTags, err := json.Marshal([]string{})
	require.NoError(t, err)

	dashboardKey := &resource.ResourceKey{
		Name:     "uid",
		Resource: dashboard.DASHBOARD_RESOURCE,
	}

	t.Run("Should parse results into GRPC", func(t *testing.T) {
		sorter, _ := sortSvc.GetSortOption("alpha-asc")
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			SignedInUser: user,      // user from context should be used
			Type:         "dash-db", // should set type based off of key
			Sort:         sorter,
		}).Return([]dashboards.DashboardSearchProjection{
			{ID: 1, UID: "uid", Title: "Test Dashboard", FolderUID: "folder1", Term: "term"},
			{ID: 2, UID: "uid2", Title: "Test Dashboard2", FolderUID: "folder2"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{
					Field: resource.SEARCH_FIELD_TITLE,
				},
			},
		}
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)

		tags, err := json.Marshal([]string{"term"})
		require.NoError(t, err)
		require.NotNil(t, resp)

		searchFields := resource.StandardSearchFields()
		require.Equal(t, &resource.ResourceSearchResponse{
			TotalHits: 2,
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					searchFields.Field(resource.SEARCH_FIELD_TITLE),
					searchFields.Field(resource.SEARCH_FIELD_FOLDER),
					searchFields.Field(resource.SEARCH_FIELD_TAGS),
					searchFields.Field(resource.SEARCH_FIELD_LEGACY_ID),
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Group:    dashboard.GROUP,
							Resource: dashboard.DASHBOARD_RESOURCE,
						},
						Cells: [][]byte{
							[]byte("Test Dashboard"),
							[]byte("folder1"),
							tags,
							[]byte("1"),
						},
					},
					{
						Key: &resource.ResourceKey{
							Name:     "uid2",
							Group:    dashboard.GROUP,
							Resource: dashboard.DASHBOARD_RESOURCE,
						},
						Cells: [][]byte{
							[]byte("Test Dashboard2"),
							[]byte("folder2"),
							emptyTags,
							[]byte("2"),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Sorting should be properly parsed into legacy sorting options (asc), and results added", func(t *testing.T) {
		sortOptionAsc := model.SortOption{
			Name: "viewed-asc", // should add -asc to the sort field and match on that
		}
		sortSvc.RegisterSortOption(sortOptionAsc)
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			SignedInUser: user,
			Type:         "dash-db",
			Sort:         sortOptionAsc,
		}).Return([]dashboards.DashboardSearchProjection{
			{ID: 1, UID: "uid", Title: "Test Dashboard", FolderUID: "folder", SortMeta: int64(50)},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{
					Field: resource.SEARCH_FIELD_PREFIX + unisearch.DASHBOARD_VIEWS_TOTAL, // "fields." prefix should be removed
					Desc:  false,
				},
			},
		}
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		searchFields := resource.StandardSearchFields()
		require.Equal(t, &resource.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					searchFields.Field(resource.SEARCH_FIELD_TITLE),
					searchFields.Field(resource.SEARCH_FIELD_FOLDER),
					searchFields.Field(resource.SEARCH_FIELD_TAGS),
					searchFields.Field(resource.SEARCH_FIELD_LEGACY_ID),
					{
						Name: "views_total",
						Type: resource.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Group:    dashboard.GROUP,
							Resource: dashboard.DASHBOARD_RESOURCE,
						},
						Cells: [][]byte{
							[]byte("Test Dashboard"),
							[]byte("folder"),
							emptyTags,
							[]byte("1"),
							[]byte(strconv.FormatInt(50, 10)),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Sorting should be properly parsed into legacy sorting options (desc)", func(t *testing.T) {
		sortOptionAsc := model.SortOption{
			Name: "errors-recently-desc", // should add -asc to the sort field and match on that
		}
		sortSvc.RegisterSortOption(sortOptionAsc)
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			SignedInUser: user,
			Type:         "dash-db",
			Sort:         sortOptionAsc,
		}).Return([]dashboards.DashboardSearchProjection{
			{ID: 1, UID: "uid", Title: "Test Dashboard", FolderUID: "folder", SortMeta: int64(2)},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{
					Field: unisearch.DASHBOARD_ERRORS_LAST_30_DAYS,
					Desc:  true,
				},
			},
		}
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		searchFields := resource.StandardSearchFields()
		require.Equal(t, &resource.ResourceSearchResponse{
			TotalHits: 1,
			Results: &resource.ResourceTable{
				Columns: []*resource.ResourceTableColumnDefinition{
					searchFields.Field(resource.SEARCH_FIELD_TITLE),
					searchFields.Field(resource.SEARCH_FIELD_FOLDER),
					searchFields.Field(resource.SEARCH_FIELD_TAGS),
					searchFields.Field(resource.SEARCH_FIELD_LEGACY_ID),
					{
						Name: "errors_last_30_days",
						Type: resource.ResourceTableColumnDefinition_INT64,
					},
				},
				Rows: []*resource.ResourceTableRow{
					{
						Key: &resource.ResourceKey{
							Name:     "uid",
							Group:    dashboard.GROUP,
							Resource: dashboard.DASHBOARD_RESOURCE,
						},
						Cells: [][]byte{
							[]byte("Test Dashboard"),
							[]byte("folder"),
							emptyTags,
							[]byte("1"),
							[]byte(strconv.FormatInt(2, 10)),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Query for tags should return facet properly", func(t *testing.T) {
		mockStore.On("GetDashboardTags", mock.Anything, &dashboards.GetDashboardTagsQuery{OrgID: 2}).Return([]*dashboards.DashboardTagCloudItem{
			{Term: "tag1", Count: 1},
			{Term: "tag2", Count: 5},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
				"tags": {
					Field: "tags",
				},
			},
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, &resource.ResourceSearchResponse{
			Results: &resource.ResourceTable{},
			Facet: map[string]*resource.ResourceSearchResponse_Facet{
				"tags": {
					Terms: []*resource.ResourceSearchResponse_TermFacet{
						{
							Term:  "tag1",
							Count: 1,
						},
						{
							Term:  "tag2",
							Count: 5,
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Query should be set as the title, and * should be removed", func(t *testing.T) {
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			Title:        "test",
			SignedInUser: user,      // user from context should be used
			Type:         "dash-db", // should set type based off of key
		}).Return([]dashboards.DashboardSearchProjection{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			Query: "*test*",
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Should read labels for the dashboard ids", func(t *testing.T) {
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			DashboardIds: []int64{1, 2},
			SignedInUser: user,      // user from context should be used
			Type:         "dash-db", // should set type based off of key
		}).Return([]dashboards.DashboardSearchProjection{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Labels: []*resource.Requirement{
					{
						Key:      utils.LabelKeyDeprecatedInternalID,
						Operator: "in",
						Values:   []string{"1", "2"},
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Should modify fields to legacy compatible queries", func(t *testing.T) {
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			DashboardUIDs: []string{"uid1", "uid2"},
			Tags:          []string{"tag1", "tag2"},
			FolderUIDs:    []string{"general", "folder1"},
			SignedInUser:  user,      // user from context should be used
			Type:          "dash-db", // should set type based off of key
		}).Return([]dashboards.DashboardSearchProjection{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_TAGS,
						Operator: "in",
						Values:   []string{"tag1", "tag2"},
					},
					{
						Key:      resource.SEARCH_FIELD_NAME, // name should be used as uid
						Operator: "in",
						Values:   []string{"uid1", "uid2"},
					},
					{
						Key:      resource.SEARCH_FIELD_FOLDER,
						Operator: "in",
						Values:   []string{"", "folder1"}, // empty folder should be general
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
	})

	t.Run("Should retrieve dashboards by plugin through a different function", func(t *testing.T) {
		mockStore.On("GetDashboardsByPluginID", mock.Anything, &dashboards.GetDashboardsByPluginIDQuery{
			PluginID: "slo",
			OrgID:    2, // retrieved from the signed in user
		}).Return([]*dashboards.Dashboard{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_MANAGER_ID,
						Operator: "in",
						Values:   []string{"slo"},
					},
					{
						Key:      resource.SEARCH_FIELD_MANAGER_KIND,
						Operator: "in",
						Values:   []string{"plugin"},
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
		require.Equal(t, resp.TotalHits, int64(1))
	})

	t.Run("Should retrieve dashboards by provisioner name through a different function", func(t *testing.T) {
		mockStore.On("GetProvisionedDashboardsByName", mock.Anything, "test", mock.Anything).Return([]*dashboards.Dashboard{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_MANAGER_KIND,
						Operator: "=",
						Values:   []string{string(utils.ManagerKindClassicFP)}, // nolint:staticcheck
					},
					{
						Key:      resource.SEARCH_FIELD_MANAGER_ID,
						Operator: "in",
						Values:   []string{"test"},
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
		require.Equal(t, resp.TotalHits, int64(1))
	})

	t.Run("Should retrieve orphaned dashboards if provisioner not in is specified", func(t *testing.T) {
		mockStore.On("GetOrphanedProvisionedDashboards", mock.Anything, []string{"test", "test2"}, mock.Anything).Return([]*dashboards.Dashboard{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_MANAGER_KIND,
						Operator: "=",
						Values:   []string{string(utils.ManagerKindClassicFP)}, // nolint:staticcheck
					},
					{
						Key:      resource.SEARCH_FIELD_MANAGER_ID,
						Operator: string(selection.NotIn),
						Values:   []string{"test", "test2"},
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
		for _, row := range resp.Results.Rows {
			require.Equal(t, len(row.Cells), len(resp.Results.Columns))
		}
		require.Equal(t, resp.TotalHits, int64(1))
	})

	t.Run("Should set empty sort field when sorting by title", func(t *testing.T) {
		mockStore.On("FindDashboards", mock.Anything, &dashboards.FindPersistedDashboardsQuery{
			SignedInUser: user,
			Sort:         sort.SortAlphaAsc,
			Type:         "dash-db",
		}).Return([]dashboards.DashboardSearchProjection{
			{ID: 1, UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{
					Field: resource.SEARCH_FIELD_TITLE,
				},
			},
		}
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Len(t, resp.Results.Columns, 4)
		mockStore.AssertExpectations(t)
	})

	t.Run("Should set correct sort field when sorting by views", func(t *testing.T) {
		mockStore.On("FindDashboards", mock.Anything, mock.Anything).Return([]dashboards.DashboardSearchProjection{
			{ID: 1, UID: "uid", Title: "Test Dashboard", FolderUID: "folder1", SortMeta: 100},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
			},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{
					Field: resource.SEARCH_FIELD_PREFIX + unisearch.DASHBOARD_VIEWS_TOTAL,
				},
			},
		}
		resp, err := client.Search(ctx, req)
		require.NoError(t, err)
		require.NotNil(t, resp)

		require.Len(t, resp.Results.Columns, 5)
		i := len(resp.Results.Columns) - 1
		require.Equal(t, "views_total", resp.Results.Columns[i].Name)
		require.Equal(t, []byte(strconv.FormatInt(100, 10)), resp.Results.Rows[0].Cells[i]) // views should be set to 100
		mockStore.AssertExpectations(t)
	})
}

func TestParseSortName(t *testing.T) {
	tests := []struct {
		name      string
		sortName  string
		wantField string
		wantDesc  bool
		wantErr   bool
	}{
		{
			name:      "empty sort name",
			sortName:  "",
			wantField: "",
			wantDesc:  false,
			wantErr:   false,
		},
		{
			name:      "viewed-recently with desc suffix",
			sortName:  "viewed-recently-desc",
			wantField: unisearch.DASHBOARD_VIEWS_LAST_30_DAYS,
			wantDesc:  true,
			wantErr:   false,
		},
		{
			name:      "defaults to desc",
			sortName:  "viewed",
			wantField: unisearch.DASHBOARD_VIEWS_TOTAL,
			wantDesc:  true,
			wantErr:   false,
		},
		{
			name:      "errors-recentlyy with asc suffix",
			sortName:  "errors-recently-asc",
			wantField: unisearch.DASHBOARD_ERRORS_LAST_30_DAYS,
			wantDesc:  false,
			wantErr:   false,
		},
		{
			name:      "errors - defaults to desc too",
			sortName:  "errors",
			wantField: unisearch.DASHBOARD_ERRORS_TOTAL,
			wantDesc:  true,
			wantErr:   false,
		},
		{
			name:      "alpha sort with asc suffix",
			sortName:  "alpha-asc",
			wantField: "title",
			wantDesc:  false,
			wantErr:   false,
		},
		{
			name:      "invalid sort name",
			sortName:  "invalid-sort-desc",
			wantField: "",
			wantDesc:  false,
			wantErr:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			field, isDesc, err := ParseSortName(tt.sortName)

			if tt.wantErr {
				require.Error(t, err)
				return
			}

			require.NoError(t, err)
			require.Equal(t, tt.wantField, field)
			require.Equal(t, tt.wantDesc, isDesc)
		})
	}
}
