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
	t.Skip("flakey tests - skipping") // sort seems different in CI... sometimes!

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
					Group:     "g",
					Resource:  "dash",
				},
				Title:  "bbb (dash)",
				Folder: "xxx",
				Fields: map[string]any{
					DASHBOARD_LEGACY_ID:    12,
					DASHBOARD_PANEL_TYPES:  []string{"timeseries", "table"},
					DASHBOARD_ERRORS_TODAY: 25,
				},
				Tags: []string{"aa", "bb"},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 2,
				Key: &resource.ResourceKey{
					Name:      "bbb",
					Namespace: "ns",
					Group:     "g",
					Resource:  "dash",
				},
				Title:  "aaa (dash)",
				Folder: "xxx",
				Fields: map[string]any{
					DASHBOARD_LEGACY_ID:    12,
					DASHBOARD_PANEL_TYPES:  []string{"timeseries"},
					DASHBOARD_ERRORS_TODAY: 40,
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
					Group:     "g",
					Resource:  "dash",
				},
				Title:  "ccc (dash)",
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

		// Match the results
		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-dashboard.json"), rsp.Results)

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
					Name:      "zzz",
					Namespace: "ns",
					Group:     "g",
					Resource:  "folder",
				},
				Title: "zzz (folder)",
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 2,
				Key: &resource.ResourceKey{
					Name:      "yyy",
					Namespace: "ns",
					Group:     "g",
					Resource:  "folder",
				},
				Title: "yyy (folder)",
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
		}, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Results)
		require.Nil(t, rsp.Facet)

		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-folder.json"), rsp.Results)
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
				"title", "_id",
			},
			Federated: []*resource.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
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

		// Sorted across two indexes
		sorted := []string{}
		for _, row := range rsp.Results.Rows {
			sorted = append(sorted, string(row.Cells[0]))
		}
		require.Equal(t, []string{
			"aaa (dash)",
			"bbb (dash)",
			"ccc (dash)",
			"yyy (folder)",
			"zzz (folder)",
		}, sorted)

		resource.AssertTableSnapshot(t, filepath.Join("testdata", "manual-federated.json"), rsp.Results)

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
	})
}
