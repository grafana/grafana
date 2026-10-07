package migrations

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestFolderTreeValidatorBuildUnifiedFolderParentMap(t *testing.T) {
	ctx := t.Context()
	client := resource.NewMockResourceClient(t)
	validator := newTestFolderTreeValidator(client)

	client.On("Search", mock.Anything, folderSearchRequest()).Return(&resourcepb.ResourceSearchResponse{
		// An older search server ignores ResultFormat and returns an unspecified table.
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: []*resourcepb.ResourceTableRow{
				{Key: &resourcepb.ResourceKey{Name: "root"}, Cells: [][]byte{nil}},
				{Key: &resourcepb.ResourceKey{Name: "child"}, Cells: [][]byte{[]byte("root")}},
			},
		},
	}, nil).Once()

	parentMap, err := validator.buildUnifiedFolderParentMap(ctx, "stack-1", log.NewNopLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"root": "", "child": "root"}, parentMap)
}

func TestFolderTreeValidatorBuildUnifiedFolderParentMapPaginates(t *testing.T) {
	setFolderSearchPageSize(t, 2)

	client := resource.NewMockResourceClient(t)
	validator := newTestFolderTreeValidator(client)

	client.On("Search", mock.Anything, folderSearchRequest()).
		Return(folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}}), nil).Once()
	client.On("Search", mock.Anything, folderSearchRequest("child-a")).
		Return(folderFieldValuesPage([]testFolder{{"child-b", "root"}, {"grandchild", "child-b"}}), nil).Once()
	client.On("Search", mock.Anything, folderSearchRequest("grandchild")).
		Return(folderFieldValuesPage([]testFolder{{"other-root", ""}}), nil).Once()

	parentMap, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"root":       "",
		"child-a":    "root",
		"child-b":    "root",
		"grandchild": "child-b",
		"other-root": "",
	}, parentMap)
}

func TestFolderTreeValidatorBuildUnifiedFolderParentMapPaginatesResourceTable(t *testing.T) {
	setFolderSearchPageSize(t, 2)

	client := resource.NewMockResourceClient(t)
	validator := newTestFolderTreeValidator(client)

	// An older server either leaves the result format unspecified or echoes
	// RESOURCE_TABLE; both are paged through the same way.
	unspecified := folderTablePage([]testFolder{{"root", ""}, {"child-a", "root"}})
	unspecified.ResultFormat = resourcepb.ResourceSearchRequest_UNSPECIFIED
	explicit := folderTablePage([]testFolder{{"child-b", "child-a"}})
	explicit.ResultFormat = resourcepb.ResourceSearchRequest_RESOURCE_TABLE

	client.On("Search", mock.Anything, folderSearchRequest()).Return(unspecified, nil).Once()
	client.On("Search", mock.Anything, folderSearchRequest("child-a")).Return(explicit, nil).Once()

	parentMap, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"root":    "",
		"child-a": "root",
		"child-b": "child-a",
	}, parentMap)
}

func TestFolderTreeValidatorBuildUnifiedFolderParentMapStopsOnEmptyPage(t *testing.T) {
	setFolderSearchPageSize(t, 2)

	client := resource.NewMockResourceClient(t)
	validator := newTestFolderTreeValidator(client)

	// The last folder filled the previous page, so the next page comes back empty.
	client.On("Search", mock.Anything, folderSearchRequest()).
		Return(folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}}), nil).Once()
	client.On("Search", mock.Anything, folderSearchRequest("child-a")).
		Return(folderFieldValuesPage(nil), nil).Once()

	parentMap, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{"root": "", "child-a": "root"}, parentMap)
}

func TestFolderTreeValidatorBuildUnifiedFolderParentMapLaterPageFails(t *testing.T) {
	t.Run("search call fails", func(t *testing.T) {
		setFolderSearchPageSize(t, 2)

		client := resource.NewMockResourceClient(t)
		validator := newTestFolderTreeValidator(client)

		client.On("Search", mock.Anything, folderSearchRequest()).
			Return(folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}}), nil).Once()
		client.On("Search", mock.Anything, folderSearchRequest("child-a")).
			Return(nil, errors.New("connection reset")).Once()

		_, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
		require.ErrorContains(t, err, "(page 2)")
		require.ErrorContains(t, err, "connection reset")
	})

	t.Run("search response carries an error", func(t *testing.T) {
		setFolderSearchPageSize(t, 2)

		client := resource.NewMockResourceClient(t)
		validator := newTestFolderTreeValidator(client)

		client.On("Search", mock.Anything, folderSearchRequest()).
			Return(folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}}), nil).Once()
		client.On("Search", mock.Anything, folderSearchRequest("child-a")).
			Return(&resourcepb.ResourceSearchResponse{Error: resource.NewBadRequestError("bad cursor")}, nil).Once()

		_, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
		require.ErrorContains(t, err, "(page 2)")
		require.ErrorContains(t, err, "bad cursor")
	})

	t.Run("unsupported result format", func(t *testing.T) {
		client := resource.NewMockResourceClient(t)
		validator := newTestFolderTreeValidator(client)

		client.On("Search", mock.Anything, folderSearchRequest()).
			Return(&resourcepb.ResourceSearchResponse{ResultFormat: 42}, nil).Once()

		_, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
		require.ErrorContains(t, err, "unsupported search result format 42")
	})
}

func TestFolderTreeValidatorBuildUnifiedFolderParentMapRejectsNonAdvancingPage(t *testing.T) {
	t.Run("page has no cursor", func(t *testing.T) {
		setFolderSearchPageSize(t, 2)

		client := resource.NewMockResourceClient(t)
		validator := newTestFolderTreeValidator(client)

		page := folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}})
		for _, row := range page.Rows {
			row.SortFields = nil
		}
		client.On("Search", mock.Anything, folderSearchRequest()).Return(page, nil).Once()

		_, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
		require.ErrorContains(t, err, "page 1 of 2 folders carries no pagination cursor")
	})

	t.Run("page repeats the cursor", func(t *testing.T) {
		setFolderSearchPageSize(t, 2)

		client := resource.NewMockResourceClient(t)
		validator := newTestFolderTreeValidator(client)

		// A server that ignores the cursor would otherwise be paged forever.
		page := folderFieldValuesPage([]testFolder{{"root", ""}, {"child-a", "root"}})
		client.On("Search", mock.Anything, folderSearchRequest()).Return(page, nil).Once()
		client.On("Search", mock.Anything, folderSearchRequest("child-a")).Return(page, nil).Once()

		_, err := validator.buildUnifiedFolderParentMap(t.Context(), "stack-1", log.NewNopLogger())
		require.ErrorContains(t, err, `page 2 did not move past cursor [child-a]`)
	})
}

func newTestFolderTreeValidator(client resourcepb.ResourceIndexClient) *FolderTreeValidator {
	return &FolderTreeValidator{
		client: client,
		resource: schema.GroupResource{
			Group:    "folder.grafana.app",
			Resource: "folders",
		},
	}
}

func setFolderSearchPageSize(t *testing.T, size int64) {
	previous := folderSearchPageSize
	folderSearchPageSize = size
	t.Cleanup(func() { folderSearchPageSize = previous })
}

// folderSearchRequest is the request the validator is expected to send to
// continue after the given cursor.
func folderSearchRequest(cursor ...string) *resourcepb.ResourceSearchRequest {
	var searchAfter []string
	if len(cursor) > 0 {
		searchAfter = cursor
	}
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: "stack-1",
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}},
		Limit:        folderSearchPageSize,
		SearchAfter:  searchAfter,
		Fields:       []string{resource.SEARCH_FIELD_FOLDER},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
}

type testFolder struct {
	name   string
	parent string
}

// folderFieldValuesPage builds a FIELD_VALUES page. Each row is sorted by its own
// name, as the search server sorts folders with the name as the last tie-breaker.
func folderFieldValuesPage(folders []testFolder) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceSearchRow, 0, len(folders))
	for _, folder := range folders {
		rows = append(rows, &resourcepb.ResourceSearchRow{
			Key: &resourcepb.ResourceKey{Name: folder.name},
			Values: []*resourcepb.ResourceSearchValue{
				{FieldIndex: 0, StringValues: []string{folder.parent}},
			},
			SortFields: []string{folder.name},
		})
	}
	return &resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		},
		Rows: rows,
	}
}

// folderTablePage is folderFieldValuesPage for the older table response shape.
func folderTablePage(folders []testFolder) *resourcepb.ResourceSearchResponse {
	rows := make([]*resourcepb.ResourceTableRow, 0, len(folders))
	for _, folder := range folders {
		rows = append(rows, &resourcepb.ResourceTableRow{
			Key:        &resourcepb.ResourceKey{Name: folder.name},
			Cells:      [][]byte{[]byte(folder.parent)},
			SortFields: []string{folder.name},
		})
	}
	return &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{
			Columns: []*resourcepb.ResourceTableColumnDefinition{
				{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceTableColumnDefinition_STRING},
			},
			Rows: rows,
		},
	}
}

// TestFolderTreeValidatorPagesRealIndex walks a bleve index with a page size
// smaller than the folder count, so the cursor paging runs against a real search
// server rather than canned responses.
func TestFolderTreeValidatorPagesRealIndex(t *testing.T) {
	setFolderSearchPageSize(t, 2)

	key := folderNamespacedResource
	index := buildFolderIndex(t, key,
		folderIndexItem(key, "root", ""),
		folderIndexItem(key, "child-a", "root"),
		folderIndexItem(key, "child-b", "root"),
		folderIndexItem(key, "grandchild", "child-b"),
		folderIndexItem(key, "other-root", ""),
	)

	validator := newTestFolderTreeValidator(&indexSearchClient{index: index})
	parentMap, err := validator.buildUnifiedFolderParentMap(t.Context(), key.Namespace, log.NewNopLogger())
	require.NoError(t, err)
	assert.Equal(t, map[string]string{
		"root":       "",
		"child-a":    "root",
		"child-b":    "root",
		"grandchild": "child-b",
		"other-root": "",
	}, parentMap)
}

func TestDecodeFolderRowsFromBleve(t *testing.T) {
	key := folderNamespacedResource
	index := buildFolderIndex(t, key,
		folderIndexItem(key, "root", ""),
		folderIndexItem(key, "child", "root"),
	)

	for _, format := range []resourcepb.ResourceSearchRequest_ResultFormat{
		resourcepb.ResourceSearchRequest_RESOURCE_TABLE,
		resourcepb.ResourceSearchRequest_FIELD_VALUES,
	} {
		t.Run(format.String(), func(t *testing.T) {
			response, err := index.Search(t.Context(), nil, &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				}},
				Limit:        10,
				Fields:       []string{resource.SEARCH_FIELD_FOLDER},
				ResultFormat: format,
			}, nil, nil)
			require.NoError(t, err)
			require.Nil(t, response.GetError())
			require.Equal(t, format, response.GetResultFormat())

			rows, err := decodeFolderRows(response)
			require.NoError(t, err)
			require.Len(t, rows, 2)

			parentMap := map[string]string{}
			for _, row := range rows {
				parentMap[row.name] = row.parent
				// Paging relies on every row carrying the cursor to resume from.
				assert.NotEmpty(t, row.cursor)
			}
			assert.Equal(t, map[string]string{"root": "", "child": "root"}, parentMap)
		})
	}
}

func TestDecodeFolderRowsRejectsMalformedFieldValues(t *testing.T) {
	_, err := decodeFolderRows(&resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Fields: []*resourcepb.ResourceSearchField{
			{Name: resource.SEARCH_FIELD_FOLDER, Type: resourcepb.ResourceSearchField_STRING},
		},
		Rows: []*resourcepb.ResourceSearchRow{
			{
				Key: &resourcepb.ResourceKey{Name: "child"},
				Values: []*resourcepb.ResourceSearchValue{
					{FieldIndex: 0, StringValues: []string{"root", "other"}},
				},
			},
		},
	})
	require.ErrorContains(t, err, `field "folder": scalar has 2 values`)
}

func TestDecodeFolderRowsRejectsRowWithoutKey(t *testing.T) {
	_, err := decodeFolderRows(&resourcepb.ResourceSearchResponse{
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
		Rows:         []*resourcepb.ResourceSearchRow{{}},
	})
	require.ErrorContains(t, err, "row 0 has no key")
}

var folderNamespacedResource = resource.NamespacedResource{
	Namespace: "stack-1",
	Group:     "folder.grafana.app",
	Resource:  "folders",
}

// indexSearchClient serves searches from a local index, so the validator can run
// against a real search server.
type indexSearchClient struct {
	resourcepb.ResourceIndexClient
	index resource.ResourceIndex
}

func (c *indexSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, _ ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return c.index.Search(ctx, nil, req, nil, nil)
}

func buildFolderIndex(t *testing.T, key resource.NamespacedResource, items ...*resource.BulkIndexItem) resource.ResourceIndex {
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	index, err := backend.BuildIndex(t.Context(), key, int64(len(items)), "test", func(index resource.ResourceIndex) (int64, error) {
		return int64(len(items)), index.BulkIndex(&resource.BulkIndexRequest{Items: items, ResourceVersion: int64(len(items))})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	return index
}

func folderIndexItem(key resource.NamespacedResource, name, parent string) *resource.BulkIndexItem {
	resourceKey := &resourcepb.ResourceKey{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
		Name:      name,
	}
	return &resource.BulkIndexItem{
		Doc: (&resource.IndexableDocument{
			Key:    resourceKey,
			Name:   name,
			Title:  name,
			Folder: parent,
		}).UpdateCopyFields(),
	}
}
