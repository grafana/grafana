package search

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestBleveBackend(t *testing.T) {
	dashboardskey := &resource.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	folderKey := &resource.ResourceKey{
		Namespace: dashboardskey.Namespace,
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}
	tmpdir, err := os.CreateTemp("", "bleve-test")
	require.NoError(t, err)

	backend := NewBleveBackend(
		bleveOptions{
			Root:          tmpdir.Name(),
			FileThreshold: 5, // with more than 5 items we create a file on disk
		},
		tracing.NewNoopTracerService(),
		nil,
	)

	rv := int64(10)
	ctx := context.Background()
	var dashboardsIndex resource.ResourceIndex
	var foldersIndex resource.ResourceIndex

	t.Run("build dashboards", func(t *testing.T) {
		key := dashboardskey
		info, err := DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &DashboardDocumentBuilder{
				Namespace:        namespace,
				Blob:             blob,
				Stats:            NewDashboardStatsLookup(nil), // empty stats
				DatasourceLookup: dashboard.CreateDatasourceLookup([]*dashboard.DatasourceQueryResult{{}}),
			}, nil
		})
		require.NoError(t, err)

		index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}, 2, rv, info.Fields, func(index resource.ResourceIndex) (int64, error) {
			_ = index.Write(&resource.IndexableDocument{
				RV: 1,
				Key: &resource.ResourceKey{
					Name:      "aaa",
					Namespace: "ns",
					Resource:  "dash",
				},
				Title:  "test aaa",
				Folder: "xxx",
				Fields: map[string]any{
					DASHBOARD_LEGACY_ID: 12,
				},
				Tags: []string{"aa", "bb"},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 2,
				Key: &resource.ResourceKey{
					Name:      "bbb",
					Namespace: "ns",
					Resource:  "dash",
				},
				Title:  "test bbb",
				Folder: "xxx",
				Fields: map[string]any{
					DASHBOARD_LEGACY_ID: 12,
				},
				Tags: []string{"aa"},
				Labels: map[string]string{
					"region": "east",
				},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 3,
				Key: &resource.ResourceKey{
					Name:      "ccc",
					Namespace: "ns",
					Resource:  "dash",
				},
				Title:  "test ccc",
				Folder: "xxx",
				Fields: map[string]any{
					DASHBOARD_LEGACY_ID: 12,
				},
				Tags: []string{"aa"},
				Labels: map[string]string{
					"region": "west",
				},
			})
			return rv, nil
		})
		require.NoError(t, err)
		require.NotNil(t, index)
		dashboardsIndex = index

		rsp, err := index.Search(ctx, nil, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: key,
			},
			Limit: 100000,
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{Field: "title", Desc: true}, // ccc,bbb,aaa
			},
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
				"tags": {
					Field: "tags",
					Limit: 100,
				},
			},
		}, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Results)
		require.NotNil(t, rsp.Facet)

		// Get the tags facets
		facet, ok := rsp.Facet["tags"]
		require.True(t, ok)
		disp, err := json.MarshalIndent(facet, "", "  ")
		require.NoError(t, err)
		//fmt.Printf("%s\n", disp)
		require.JSONEq(t, `{
			"field": "tags",
			"total": 4,
			"terms": [
				{
					"term": "aa",
					"count": 3
				},
				{
					"term": "bb",
					"count": 1
				}
			]
		}`, string(disp))

		// Match the results
		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-dashboard"), rsp.Results)
	})

	t.Run("build folders", func(t *testing.T) {
		key := folderKey
		var fields resource.SearchableDocumentFields

		index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}, 2, rv, fields, func(index resource.ResourceIndex) (int64, error) {
			_ = index.Write(&resource.IndexableDocument{
				RV: 1,
				Key: &resource.ResourceKey{
					Name:      "xxx",
					Namespace: "ns",
					Resource:  "folder",
				},
				Title: "test xxx",
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 2,
				Key: &resource.ResourceKey{
					Name:      "yyy",
					Namespace: "ns",
					Resource:  "folder",
				},
				Title: "test yyy",
				Labels: map[string]string{
					"region": "west",
				},
			})
			return rv, nil
		})
		require.NoError(t, err)
		require.NotNil(t, index)
		foldersIndex = index

		rsp, err := index.Search(ctx, nil, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: key,
			},
			Limit: 100000,
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
				"anything": {
					Field: "origin_name",
					Limit: 100,
				},
			},
		}, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Results)
		require.NotNil(t, rsp.Facet)

		// Get the tags facets
		facet, ok := rsp.Facet["anything"]
		require.True(t, ok)
		disp, err := json.MarshalIndent(facet, "", "  ")
		require.NoError(t, err)
		// fmt.Printf("%s\n", disp)
		require.JSONEq(t, `{
			"field": "origin_name",
			"total": 2,
			"terms": [
				{
					"term": "sql",
					"count": 2
				}
			]
		}`, string(disp))

		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-folder"), rsp.Results)
	})

	t.Run("simple federation", func(t *testing.T) {
		// The other tests must run first to build the indexes
		require.NotNil(t, dashboardsIndex)
		require.NotNil(t, foldersIndex)

		// Use a federated query to get both results together, sorted by title
		rsp, err := dashboardsIndex.Search(ctx, nil, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: dashboardskey,
			},
			Fields: []string{
				"id", "title", "tags", "labels.region",
			},
			Federated: []*resource.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			// SortBy: []*resource.ResourceSearchRequest_Sort{
			// 	{Field: "title", Asc: true},
			// },
			// Count across both resources
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
				"region": {
					Field: "labels.region",
					Limit: 100,
				},
			},
		}, []resource.ResourceIndex{foldersIndex}) // << note the folder index matches the federation request
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Results)
		require.NotNil(t, rsp.Facet)

		facet, ok := rsp.Facet["region"]
		require.True(t, ok)
		disp, err := json.MarshalIndent(facet, "", "  ")
		require.NoError(t, err)
		// fmt.Printf("%s\n", disp)
		// NOTE, the west values come from *both* dashboards and folders
		require.JSONEq(t, `{
			"field": "labels.region",
			"total": 3,
			"missing": 2,
			"terms": [
				{
					"term": "west",
					"count": 2
				},
				{
					"term": "east",
					"count": 1
				}
			]
		}`, string(disp))

		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-federated"), rsp.Results)
	})
}
