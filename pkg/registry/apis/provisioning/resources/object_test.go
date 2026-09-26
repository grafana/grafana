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

func resourceListSearchResponse(t *testing.T, format resourcepb.ResourceSearchRequest_ResultFormat, withCursor bool, items ...provisioning.ResourceListItem) *resourcepb.ResourceSearchResponse {
	t.Helper()
	response := &resourcepb.ResourceSearchResponse{ResultFormat: format}
	if format != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		response.Results = resourceListSearchTable(t, items...)
		if withCursor {
			for _, row := range response.Results.Rows {
				row.SortFields = []string{row.Key.Name, "doc-" + row.Key.Name}
			}
		}
		return response
	}
	response.Fields = []*resourcepb.ResourceSearchField{
		{Name: resource.SEARCH_FIELD_SOURCE_TIME, Type: resourcepb.ResourceSearchField_INT64},
		{Name: resource.SEARCH_FIELD_SOURCE_CHECKSUM, Type: resourcepb.ResourceSearchField_STRING},
		{Name: resource.SEARCH_FIELD_SOURCE_PATH, Type: resourcepb.ResourceSearchField_STRING},
		{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		{Name: resource.SEARCH_FIELD_TITLE, Type: resourcepb.ResourceSearchField_STRING},
	}
	for _, item := range items {
		row := &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Namespace: "default", Group: item.Group, Resource: item.Resource, Name: item.Name},
			Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 3, StringValues: []string{item.Folder}},
				{FieldIndex: 2, StringValues: []string{item.Path}},
				{FieldIndex: 1, StringValues: []string{item.Hash}},
				{FieldIndex: 4, StringValues: []string{item.Title}},
				{FieldIndex: 0, Int64Values: []int64{item.Time}},
			},
		}
		if withCursor {
			row.SortFields = []string{row.Key.Name, "doc-" + row.Key.Name}
		}
		response.Rows = append(response.Rows, row)
	}
	return response
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
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
	} {
		for _, withCursor := range []bool{false, true} {
			t.Run(fmt.Sprintf("%s/cursor=%t", format, withCursor), func(t *testing.T) {
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
					assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
					assert.Empty(t, req.Federated)
					assert.Empty(t, req.Query)
					assert.False(t, req.IsDeleted)
					return resourceListSearchResponse(t, format, withCursor, call.items...), nil
				}}

				list, err := NewResourceLister(store).Search(ctx, "default", "repo-1", []schema.GroupResource{dashboards, dashboards, folders, custom})
				require.NoError(t, err)
				assert.Equal(t, len(calls), count)
				assert.Equal(t, want, list.Items)
			})
		}
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
	for _, formats := range [][]resourcepb.ResourceSearchRequest_ResultFormat{
		{resourcepb.ResourceSearchRequest_FIELD_VALUES},
		{resourcepb.ResourceSearchRequest_RESOURCE_TABLE},
		{resourcepb.ResourceSearchRequest_UNSPECIFIED},
		{resourcepb.ResourceSearchRequest_UNSPECIFIED, resourcepb.ResourceSearchRequest_FIELD_VALUES, resourcepb.ResourceSearchRequest_RESOURCE_TABLE},
	} {
		t.Run(fmt.Sprint(formats), func(t *testing.T) {
			count := 0
			store := resourceListerSearchStore{search: func(_ context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				require.Less(t, count, len(calls))
				call := calls[count]
				format := formats[count%len(formats)]
				count++
				assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
				assert.Equal(t, call.offset, req.Offset)
				assert.Equal(t, call.searchAfter, req.SearchAfter)
				response := resourceListSearchResponse(t, format, false, call.items...)
				for i, sortFields := range call.sortFields {
					if format == resourcepb.ResourceSearchRequest_FIELD_VALUES {
						response.Rows[i].SortFields = sortFields
					} else {
						response.Results.Rows[i].SortFields = sortFields
					}
				}
				response.TotalHits = 100
				return response, nil
			}}

			list, err := NewResourceLister(store).Search(context.Background(), "default", "repo-1", []schema.GroupResource{resourceType})
			require.NoError(t, err)
			assert.Equal(t, len(calls), count)
			assert.Equal(t, items, list.Items)
		})
	}
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
	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_UNSPECIFIED,
	} {
		t.Run(format.String(), func(t *testing.T) {
			response := resourceListSearchResponse(t, format, false, item)
			empty := &resourcepb.ResourceSearchResponse{ResultFormat: format}
			if format == resourcepb.ResourceSearchRequest_FIELD_VALUES {
				response.Rows[0].Values = nil
			} else {
				response.Results.Rows[0].Cells = make([][]byte, len(response.Results.Columns))
				empty.Results = &resourcepb.ResourceTable{}
			}
			count := 0
			store := resourceListerSearchStore{search: func(_ context.Context, req *resourcepb.ResourceSearchRequest) (*resourcepb.ResourceSearchResponse, error) {
				count++
				require.LessOrEqual(t, count, 2)
				assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
				if count == 1 {
					return response, nil
				}
				assert.Equal(t, int64(1), req.Offset)
				return empty, nil
			}}
			list, err := NewResourceLister(store).Search(context.Background(), "default", "repo-1", []schema.GroupResource{resourceType})
			require.NoError(t, err)
			assert.Equal(t, 2, count)
			assert.Equal(t, []provisioning.ResourceListItem{item}, list.Items)
		})
	}
}

func TestResourceListerSearchErrors(t *testing.T) {
	resourceType := schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	item := provisioning.ResourceListItem{Group: resourceType.Group, Resource: resourceType.Resource, Name: "dash-1", Path: "a.json"}
	searchErr := errors.New("search unavailable")
	tests := []struct {
		name   string
		format resourcepb.ResourceSearchRequest_ResultFormat
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
			r.ResultFormat = resourcepb.ResourceSearchRequest_ResultFormat(99)
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
		{name: "field values transport error", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(_ *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			return nil, searchErr
		}, want: searchErr.Error()},
		{name: "field values embedded error", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Error = resource.NewBadRequestError("search is invalid")
			return r, nil
		}, want: "search is invalid"},
		{name: "field values nil row", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0] = nil
			return r, nil
		}, want: "missing resource key"},
		{name: "field values nil key", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Key = nil
			return r, nil
		}, want: "missing resource key"},
		{name: "field values missing name", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Key.Name = ""
			return r, nil
		}, want: "missing resource key"},
		{name: "field values wrong namespace", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Key.Namespace = "other"
			return r, nil
		}, want: "does not match"},
		{name: "field values wrong group", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Key.Group = "other"
			return r, nil
		}, want: "does not match"},
		{name: "field values wrong resource", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Key.Resource = "other"
			return r, nil
		}, want: "does not match"},
		{name: "nil field definition", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Fields[0] = nil
			return r, nil
		}, want: "missing field definition"},
		{name: "duplicate field definition", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Fields[0] = r.Fields[1]
			return r, nil
		}, want: "duplicate field"},
		{name: "missing folder field", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Fields[3].Name = "other"
			return r, nil
		}, want: "missing field \"folder\""},
		{name: "nil field value", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Values[0] = nil
			return r, nil
		}, want: "nil field value"},
		{name: "duplicate field index", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Values[0] = r.Rows[0].Values[1]
			return r, nil
		}, want: "duplicate field index"},
		{name: "invalid field index", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Values[0].FieldIndex = uint32(len(r.Fields))
			return r, nil
		}, want: "out of range"},
		{name: "invalid scalar", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Rows[0].Values[0].StringValues = []string{"one", "two"}
			return r, nil
		}, want: "scalar has 2 values"},
		{name: "field values wrong string type", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Fields[3].Type = resourcepb.ResourceSearchField_INT64
			r.Rows[0].Values[0] = &resourcepb.ResourceSearchValue{FieldIndex: 3, Int64Values: []int64{42}}
			return r, nil
		}, want: "expected string"},
		{name: "array instead of string", format: resourcepb.ResourceSearchRequest_FIELD_VALUES, mutate: func(r *resourcepb.ResourceSearchResponse) (*resourcepb.ResourceSearchResponse, error) {
			r.Fields[3].IsArray = true
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
						assert.Equal(t, resourcepb.ResourceSearchRequest_FIELD_VALUES, req.ResultFormat)
						response := resourceListSearchResponse(t, tt.format, withCursor, item)
						if count == 1 {
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
					if tt.want == searchErr.Error() {
						assert.ErrorIs(t, err, searchErr)
					}
				})
			}
		})
	}
}
