package migrations

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

func TestFolderTreeValidatorBuildUnifiedFolderParentMap(t *testing.T) {
	ctx := t.Context()
	client := resource.NewMockResourceClient(t)
	validator := &FolderTreeValidator{
		client: client,
		resource: schema.GroupResource{
			Group:    "folder.grafana.app",
			Resource: "folders",
		},
	}

	request := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{
			Namespace: "stack-1",
			Group:     "folder.grafana.app",
			Resource:  "folders",
		}},
		Limit:        100000,
		Fields:       []string{resource.SEARCH_FIELD_FOLDER},
		ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
	}
	client.On("Search", mock.Anything, request).Return(&resourcepb.ResourceSearchResponse{
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

func TestDecodeFolderParentMapFromBleve(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "stack-1",
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	index, err := backend.BuildIndex(t.Context(), key, 2, "test", func(index resource.ResourceIndex) (int64, error) {
		items := []*resource.BulkIndexItem{
			folderIndexItem(key, "root", ""),
			folderIndexItem(key, "child", "root"),
		}
		return 2, index.BulkIndex(&resource.BulkIndexRequest{Items: items, ResourceVersion: 2})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

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

			parentMap, err := decodeFolderParentMap(response)
			require.NoError(t, err)
			assert.Equal(t, map[string]string{"root": "", "child": "root"}, parentMap)
		})
	}
}

func TestDecodeFolderParentMapRejectsMalformedFieldValues(t *testing.T) {
	_, err := decodeFolderParentMap(&resourcepb.ResourceSearchResponse{
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
