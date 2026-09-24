package resources

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime/schema"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type resourceListerSearchStore struct {
	ResourceStore
	search func(context.Context, *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error)
}

func (s resourceListerSearchStore) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return s.search(ctx, req)
}

func resourceListSearchTable(t *testing.T, items ...provisioning.ResourceListItem) *resourcepb.ResourceTable {
	t.Helper()
	// The server can return extra columns in a different order from the requested fields.
	fields := []string{
		resource.SEARCH_FIELD_SOURCE_TIME,
		resource.SEARCH_FIELD_SOURCE_CHECKSUM,
		resource.SEARCH_FIELD_SOURCE_PATH,
		resource.SEARCH_FIELD_FOLDER,
		resource.SEARCH_FIELD_TITLE,
	}
	columns := make([]*resourcepb.ResourceTableColumnDefinition, 0, len(fields))
	for _, field := range fields {
		columns = append(columns, proto.Clone(resource.StandardSearchFields().Field(field)).(*resourcepb.ResourceTableColumnDefinition))
	}
	table, err := resource.NewTableBuilder(columns)
	require.NoError(t, err)
	for _, item := range items {
		err := table.AddRow(&resourcepb.ResourceKey{
			Namespace: "default",
			Group:     item.Group,
			Resource:  item.Resource,
			Name:      item.Name,
		}, 1, map[string]any{
			resource.SEARCH_FIELD_TITLE:           item.Title,
			resource.SEARCH_FIELD_FOLDER:          item.Folder,
			resource.SEARCH_FIELD_SOURCE_PATH:     item.Path,
			resource.SEARCH_FIELD_SOURCE_CHECKSUM: item.Hash,
			resource.SEARCH_FIELD_SOURCE_TIME:     item.Time,
		})
		require.NoError(t, err)
	}
	return &table.ResourceTable
}

func TestResourceListerSearch(t *testing.T) {
	dashboards := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	folders := schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
	custom := schema.GroupResource{Group: "example.grafana.app", Resource: "people"}
	dashboardItems := make([]provisioning.ResourceListItem, 102)
	for i := range dashboardItems {
		dashboardItems[i] = provisioning.ResourceListItem{
			Group: dashboards.Group, Resource: dashboards.Resource, Name: fmt.Sprintf("dash-%03d", i),
			Path: fmt.Sprintf("team/%03d.json", i), Title: fmt.Sprintf("Dashboard %d", i), Folder: "team",
			Hash: fmt.Sprintf("hash-%d", i), Time: 1_700_000_000_000 + int64(i),
		}
	}
	// Separate identities claiming a path must remain separate results.
	dashboardItems[1].Path = dashboardItems[0].Path
	folderItem := provisioning.ResourceListItem{Group: folders.Group, Resource: folders.Resource, Name: "team", Path: "team/", Title: "Team", Hash: "folder-hash", Time: 1_700_000_000_000}
	customItem := provisioning.ResourceListItem{Group: custom.Group, Resource: custom.Resource, Name: "person", Path: dashboardItems[0].Path, Title: "Person"}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	type call struct {
		resource    schema.GroupResource
		offset      int64
		searchAfter []string
		items       []provisioning.ResourceListItem
	}
	calls := []call{
		{resource: dashboards, offset: 0, items: dashboardItems[:100]},
		{resource: dashboards, offset: 100, searchAfter: []string{"dash-099", "doc-dash-099"}, items: dashboardItems[100:101]},
		{resource: dashboards, offset: 101, searchAfter: []string{"dash-100", "doc-dash-100"}, items: dashboardItems[101:]},
		{resource: dashboards, offset: 102, searchAfter: []string{"dash-101", "doc-dash-101"}},
		{resource: folders, offset: 0, items: []provisioning.ResourceListItem{folderItem}},
		{resource: folders, offset: 1, searchAfter: []string{"team", "doc-team"}},
		{resource: custom, offset: 0, items: []provisioning.ResourceListItem{customItem}},
		{resource: custom, offset: 1, searchAfter: []string{"person", "doc-person"}},
	}

	want := append([]provisioning.ResourceListItem{}, dashboardItems...)
	want = append(want, folderItem, customItem)
	for i := range want {
		want[i].Title = ""
		want[i].Hash = ""
		want[i].Time = 0
	}
	for _, withCursor := range []bool{false, true} {
		t.Run(fmt.Sprintf("cursor=%t", withCursor), func(t *testing.T) {
			count := 0
			store := resourceListerSearchStore{search: func(actualCtx context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				require.Less(t, count, len(calls))
				call := calls[count]
				count++
				assert.Same(t, ctx, actualCtx)
				assert.Equal(t, &resourcepb.ResourceKey{Namespace: "default", Group: call.resource.Group, Resource: call.resource.Resource}, req.Options.Key)
				assert.Equal(t, []*resourcepb.Requirement{
					{Key: "manager.kind", Operator: "=", Values: []string{"repo"}},
					{Key: "manager.id", Operator: "=", Values: []string{"repo-1"}},
				}, req.Options.Fields)
				assert.Equal(t, []string{"folder", "source.path"}, req.Fields)
				assert.Equal(t, int64(100), req.Limit)
				if withCursor {
					assert.Zero(t, req.Offset)
					assert.Equal(t, call.searchAfter, req.SearchAfter)
				} else {
					assert.Equal(t, call.offset, req.Offset)
					assert.Empty(t, req.SearchAfter)
				}
				assert.Equal(t, []*resourcepb.ResourceSearchRequest_Sort{{Field: "name"}}, req.SortBy)
				assert.Equal(t, resourcepb.ResourceSearchRequest_RESOURCE_TABLE, req.ResultFormat)
				assert.Empty(t, req.Federated)
				assert.Empty(t, req.Query)
				assert.False(t, req.IsDeleted)
				table := resourceListSearchTable(t, call.items...)
				if withCursor {
					for _, row := range table.Rows {
						row.SortFields = []string{row.Key.Name, "doc-" + row.Key.Name}
					}
				}
				return &resourcepb.ResourceSearchResponse{
					Results:        table,
					ResultFormat:   resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
					TotalHits:      0,
					TotalHitsExact: false,
				}, nil
			}}

			list, err := NewResourceLister(store).Search(ctx, "default", "repo-1", []schema.GroupResource{dashboards, dashboards, folders, custom})
			require.NoError(t, err)
			assert.Equal(t, len(calls), count)
			assert.Equal(t, want, list.Items)
		})
	}
}

func TestResourceListerSearchPaginationTransitions(t *testing.T) {
	resourceType := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	items := make([]provisioning.ResourceListItem, 5)
	for i := range items {
		items[i] = provisioning.ResourceListItem{
			Group: resourceType.Group, Resource: resourceType.Resource,
			Name: fmt.Sprintf("dash-%d", i), Path: fmt.Sprintf("%d.json", i),
		}
	}
	calls := []struct {
		offset      int64
		searchAfter []string
		items       []provisioning.ResourceListItem
		sortFields  [][]string
	}{
		{items: items[:2]},
		{offset: 2, items: items[2:3], sortFields: [][]string{{"dash-2", "doc-dash-2"}}},
		// Overlapping pages still consume raw rows; only the last row can supply the next cursor.
		{searchAfter: []string{"dash-2", "doc-dash-2"}, items: items[2:4], sortFields: [][]string{{"dash-2", "doc-dash-2"}, {}}},
		{offset: 5, items: items[4:], sortFields: [][]string{{"dash-4", "doc-dash-4"}}},
		{searchAfter: []string{"dash-4", "doc-dash-4"}},
	}
	count := 0
	store := resourceListerSearchStore{search: func(_ context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
		require.Less(t, count, len(calls))
		call := calls[count]
		count++
		assert.Equal(t, call.offset, req.Offset)
		assert.Equal(t, call.searchAfter, req.SearchAfter)
		table := resourceListSearchTable(t, call.items...)
		for i, sortFields := range call.sortFields {
			table.Rows[i].SortFields = sortFields
		}
		return &resourcepb.ResourceSearchResponse{Results: table, TotalHits: 100, TotalHitsExact: false}, nil
	}}

	list, err := NewResourceLister(store).Search(context.Background(), "default", "repo-1", []schema.GroupResource{resourceType})
	require.NoError(t, err)
	assert.Equal(t, len(calls), count)
	assert.Equal(t, items, list.Items)
}

func TestResourceListerSearchEmpty(t *testing.T) {
	lister := NewResourceLister(resourceListerSearchStore{})
	list, err := lister.Search(context.Background(), "default", "repo-1", nil)
	require.NoError(t, err)
	assert.Equal(t, &provisioning.ResourceList{Items: []provisioning.ResourceListItem{}}, list)
}

func TestResourceListerSearchLegacyAndMissingValues(t *testing.T) {
	resourceType := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	item := provisioning.ResourceListItem{Group: resourceType.Group, Resource: resourceType.Resource, Name: "dash-1"}
	table := resourceListSearchTable(t, item)
	table.Rows[0].Cells = make([][]byte, len(table.Columns))
	store := resourceListerSearchStore{search: func(_ context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
		if req.Offset > 0 {
			return &resourcepb.ResourceSearchResponse{Results: &resourcepb.ResourceTable{}}, nil
		}
		return &resourcepb.ResourceSearchResponse{Results: table}, nil
	}}
	list, err := NewResourceLister(store).Search(context.Background(), "default", "repo-1", []schema.GroupResource{resourceType})
	require.NoError(t, err)
	assert.Equal(t, []provisioning.ResourceListItem{item}, list.Items)
}

func TestResourceListerSearchErrors(t *testing.T) {
	resourceType := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	item := provisioning.ResourceListItem{Group: resourceType.Group, Resource: resourceType.Resource, Name: "dash-1", Path: "a.json"}
	searchErr := errors.New("search unavailable")
	tests := []struct {
		name   string
		mutate func(*resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error)
		want   string
	}{
		{name: "transport error", mutate: func(_ *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			return nil, searchErr
		}, want: searchErr.Error()},
		{name: "embedded error", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Error = resource.NewBadRequestError("search is invalid")
			return r, nil
		}, want: "search is invalid"},
		{name: "nil response", mutate: func(_ *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			return nil, nil
		}, want: "missing response"},
		{name: "nil table", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results = nil
			return r, nil
		}, want: "missing result table"},
		{name: "unsupported format", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.ResultFormat = resourcepb.ResourceSearchRequest_FIELD_VALUES
			return r, nil
		}, want: "unsupported result format"},
		{name: "nil row", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0] = nil
			return r, nil
		}, want: "missing resource key"},
		{name: "nil key", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Key = nil
			return r, nil
		}, want: "missing resource key"},
		{name: "missing name", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Key.Name = ""
			return r, nil
		}, want: "missing resource key"},
		{name: "wrong namespace", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Key.Namespace = "other"
			return r, nil
		}, want: "does not match"},
		{name: "wrong group", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Key.Group = "other"
			return r, nil
		}, want: "does not match"},
		{name: "wrong resource", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Key.Resource = "other"
			return r, nil
		}, want: "does not match"},
		{name: "nil column", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Columns[0] = nil
			return r, nil
		}, want: "missing column definition"},
		{name: "duplicate column", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Columns[0] = r.Results.Columns[1]
			return r, nil
		}, want: "duplicate column"},
		{name: "missing folder column", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Columns[3].Name = "other"
			return r, nil
		}, want: "missing column \"folder\""},
		{name: "cell count mismatch", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Rows[0].Cells = nil
			return r, nil
		}, want: "row has 0 cells"},
		{name: "invalid cell encoding", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Columns[2].Type = resourcepb.ResourceTableColumnDefinition_INT64
			r.Results.Rows[0].Cells[2] = []byte("invalid")
			return r, nil
		}, want: "decoding column"},
		{name: "wrong string type", mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Results.Columns[2].Type = resourcepb.ResourceTableColumnDefinition_INT64
			r.Results.Rows[0].Cells[2] = []byte("42")
			return r, nil
		}, want: "expected string"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for _, withCursor := range []bool{false, true} {
				t.Run(fmt.Sprintf("cursor=%t", withCursor), func(t *testing.T) {
					count := 0
					cursor := []string{"dash-1", "doc-dash-1"}
					store := resourceListerSearchStore{search: func(_ context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
						count++
						require.LessOrEqual(t, count, 2)
						response := &resourcepb.ResourceSearchResponse{Results: resourceListSearchTable(t, item)}
						if count == 1 {
							if withCursor {
								response.Results.Rows[0].SortFields = cursor
							}
							return response, nil
						}
						if withCursor {
							assert.Zero(t, req.Offset)
							assert.Equal(t, cursor, req.SearchAfter)
						} else {
							assert.Equal(t, int64(1), req.Offset)
							assert.Empty(t, req.SearchAfter)
						}
						return tt.mutate(response)
					}}
					list, err := NewResourceLister(store).Search(context.Background(), "default", "repo-1", []schema.GroupResource{resourceType})
					require.ErrorContains(t, err, tt.want)
					assert.Equal(t, 2, count)
					assert.Nil(t, list, "errors on later pages must not return a partial list")
					if tt.name == "transport error" {
						assert.ErrorIs(t, err, searchErr)
					}
				})
			}
		})
	}
}
