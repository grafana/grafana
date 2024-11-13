package search

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/infra/tracing"
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

	backend := &bleveBackend{
		tracer: tracing.NewNoopTracerService(),
		log:    slog.Default(),
		opts: bleveOptions{
			Root:          tmpdir.Name(),
			FileThreshold: 5,
		},
		cache: make(map[resource.NamespacedResource]*bleveIndex),
	}

	rv := int64(10)
	ctx := context.Background()
	var dashboardsIndex resource.ResourceIndex
	var foldersIndex resource.ResourceIndex

	t.Run("build dashboards", func(t *testing.T) {
		key := dashboardskey

		index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}, 2, rv, func(index resource.ResourceIndex) (int64, error) {
			index.Write(&StandardDocumentFields{
				RV:         1,
				ID:         "dash/aaa",
				Name:       "aaa",
				Title:      "test aaa",
				Folder:     "xxx",
				OriginName: "SQL",
				Tags:       []string{"aa", "bb"},
				Created:    time.Unix(10000, 0), // searchable, but not stored!!! (by default)
			})
			index.Write(&StandardDocumentFields{
				RV:         2,
				ID:         "dash/bbb",
				Name:       "bbb",
				Title:      "test bbb",
				Folder:     "yyy",
				OriginName: "SQL",
				Tags:       []string{"aa"},
				Labels: map[string]string{
					"region": "east",
				},
			})
			index.Write(&StandardDocumentFields{
				RV:         2,
				ID:         "dash/ccc",
				Name:       "ccc",
				Title:      "test ccc",
				Folder:     "xxx",
				OriginName: "SQL",
				Tags:       []string{"aa"},
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
			// SortBy: []*resource.ResourceSearchRequest_Sort{
			// 	{Field: "title", Asc: false}, // ccc,bbb,aaa
			// },
			Facet: map[string]*resource.ResourceSearchRequest_Facet{
				"tags": {
					Field: "tags",
					Limit: 100,
				},
			},
		}, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Frame)
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

		frame := &data.Frame{}
		err = frame.UnmarshalJSON(rsp.Frame)
		require.NoError(t, err)

		// Verify the results in testdata
		experimental.CheckGoldenJSONFrame(t, "testdata", "manual-dashboard", frame, true)
	})

	t.Run("build folders", func(t *testing.T) {
		key := folderKey

		index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
			Namespace: key.Namespace,
			Group:     key.Group,
			Resource:  key.Resource,
		}, 2, rv, func(index resource.ResourceIndex) (int64, error) {
			index.Write(&StandardDocumentFields{
				RV:         1,
				ID:         "folder/xxx",
				Name:       "xxx",
				Title:      "test xxx",
				OriginName: "SQL",
				Created:    time.Unix(10000, 0), // searchable, but not stored!!! (by default)
			})
			index.Write(&StandardDocumentFields{
				RV:         2,
				ID:         "folder/yyy",
				Name:       "yyy",
				Title:      "test yyy",
				OriginName: "SQL",
				Labels: map[string]string{
					"region": "west",
				},
				Created: time.Unix(10000, 0), // searchable, but not stored!!! (by default)
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
		require.NotNil(t, rsp.Frame)
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

		frame := &data.Frame{}
		err = frame.UnmarshalJSON(rsp.Frame)
		require.NoError(t, err)

		// Verify the results in testdata
		experimental.CheckGoldenJSONFrame(t, "testdata", "manual-folder", frame, true)
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
		require.NotNil(t, rsp.Frame)
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

		frame := &data.Frame{}
		err = frame.UnmarshalJSON(rsp.Frame)
		require.NoError(t, err)

		// Verify the results in testdata
		experimental.CheckGoldenJSONFrame(t, "testdata", "manual-federated", frame, true)
	})
}
