package legacysearcher

import (
	"context"
	"encoding/json"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/dashboard"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	unisearch "github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/selection"
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
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1", Term: "term"},
			{UID: "uid2", Title: "Test Dashboard2", FolderUID: "folder2"},
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
					{
						Name: "", // sort by should be empty if title is what we sorted by
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
							[]byte("folder1"),
							tags,
							[]byte(strconv.FormatInt(0, 10)),
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
							[]byte(strconv.FormatInt(0, 10)),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
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
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder", SortMeta: int64(50)},
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
							[]byte(strconv.FormatInt(50, 10)),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
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
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder", SortMeta: int64(2)},
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
							[]byte(strconv.FormatInt(2, 10)),
						},
					},
				},
			},
		}, resp)
		mockStore.AssertExpectations(t)
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
						Key:      resource.SEARCH_FIELD_REPOSITORY_PATH,
						Operator: "in",
						Values:   []string{"slo"},
					},
					{
						Key:      resource.SEARCH_FIELD_REPOSITORY_NAME,
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
	})

	t.Run("Should retrieve dashboards by provisioner name through a different function", func(t *testing.T) {
		mockStore.On("GetProvisionedDashboardsByName", mock.Anything, "test").Return([]*dashboards.Dashboard{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_REPOSITORY_NAME,
						Operator: "in",
						Values:   []string{"file:test"}, // file prefix should be removed before going to legacy
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
	})

	t.Run("Should retrieve orphaned dashboards if provisioner not in is specified", func(t *testing.T) {
		mockStore.On("GetOrphanedProvisionedDashboards", mock.Anything, []string{"test", "test2"}).Return([]*dashboards.Dashboard{
			{UID: "uid", Title: "Test Dashboard", FolderUID: "folder1"},
		}, nil).Once()

		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardKey,
				Fields: []*resource.Requirement{
					{
						Key:      resource.SEARCH_FIELD_REPOSITORY_NAME,
						Operator: string(selection.NotIn),
						Values:   []string{"file:test", "file:test2"}, // file prefix should be removed before going to legacy
					},
				},
			},
		}
		resp, err := client.Search(ctx, req)

		require.NoError(t, err)
		require.NotNil(t, resp)
		mockStore.AssertExpectations(t)
	})
}
