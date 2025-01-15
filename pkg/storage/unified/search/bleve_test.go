package search

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
	tmpdir, err := os.MkdirTemp("", "grafana-bleve-test")
	require.NoError(t, err)

	backend, err := NewBleveBackend(BleveOptions{
		Root:          tmpdir,
		FileThreshold: 5, // with more than 5 items we create a file on disk
	}, tracing.NewNoopTracerService())
	require.NoError(t, err)

	// AVOID NPE in test
	resource.NewIndexMetrics(backend.opts.Root, backend)

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
				Stats:            make(map[string]map[string]int64), // empty stats
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
				RV:   1,
				Name: "aaa",
				Key: &resource.ResourceKey{
					Name:      "aaa",
					Namespace: "ns",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
				Title:     "aaa (dash)",
				TitleSort: "aaa (dash)",
				Folder:    "xxx",
				Fields: map[string]any{
					DASHBOARD_PANEL_TYPES:       []string{"timeseries", "table"},
					DASHBOARD_ERRORS_TODAY:      25,
					DASHBOARD_VIEWS_LAST_1_DAYS: 50,
				},
				Labels: map[string]string{
					utils.LabelKeyDeprecatedInternalID: "10", // nolint:staticcheck
				},
				Tags: []string{"aa", "bb"},
				RepoInfo: &utils.ResourceRepositoryInfo{
					Name:      "repo-1",
					Path:      "path/to/aaa.json",
					Hash:      "xyz",
					Timestamp: asTimePointer(1609462800000), // 2021
				},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV:   2,
				Name: "bbb",
				Key: &resource.ResourceKey{
					Name:      "bbb",
					Namespace: "ns",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
				Title:     "bbb (dash)",
				TitleSort: "bbb (dash)",
				Folder:    "xxx",
				Fields: map[string]any{
					DASHBOARD_PANEL_TYPES:       []string{"timeseries"},
					DASHBOARD_ERRORS_TODAY:      40,
					DASHBOARD_VIEWS_LAST_1_DAYS: 100,
				},
				Tags: []string{"aa"},
				Labels: map[string]string{
					"region":                           "east",
					utils.LabelKeyDeprecatedInternalID: "11", // nolint:staticcheck
				},
				RepoInfo: &utils.ResourceRepositoryInfo{
					Name:      "repo-1",
					Path:      "path/to/bbb.json",
					Hash:      "hijk",
					Timestamp: asTimePointer(1640998800000), // 2022
				},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 3,
				Key: &resource.ResourceKey{
					Name:      "ccc",
					Namespace: "ns",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
				Name:      "ccc",
				Title:     "ccc (dash)",
				TitleSort: "ccc (dash)",
				Folder:    "zzz",
				RepoInfo: &utils.ResourceRepositoryInfo{
					Name: "repo2",
					Path: "path/in/repo2.yaml",
				},
				Fields: map[string]any{},
				Tags:   []string{"aa"},
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
				{Field: resource.SEARCH_FIELD_TITLE, Desc: true}, // ccc,bbb,aaa
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

		count, _ := index.DocCount(ctx, "")
		assert.Equal(t, int64(3), count)

		count, _ = index.DocCount(ctx, "zzz")
		assert.Equal(t, int64(1), count)

		rsp, err = index.Search(ctx, nil, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: key,
				Labels: []*resource.Requirement{{
					Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
					Operator: "in",
					Values:   []string{"10", "11"},
				}},
			},
			Limit: 100000,
		}, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), rsp.TotalHits)
		require.Equal(t, []string{"aaa", "bbb"}, []string{
			rsp.Results.Rows[0].Key.Name,
			rsp.Results.Rows[1].Key.Name,
		})

		// can get sprinkles fields
		rsp, err = index.Search(ctx, nil, &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: key,
			},
			Limit:  100000,
			Fields: []string{DASHBOARD_ERRORS_TODAY, DASHBOARD_VIEWS_LAST_1_DAYS, "fieldThatDoesntExist"},
			SortBy: []*resource.ResourceSearchRequest_Sort{
				{Field: "fields." + DASHBOARD_VIEWS_LAST_1_DAYS, Desc: true},
			},
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 2, len(rsp.Results.Columns))
		require.Equal(t, DASHBOARD_ERRORS_TODAY, rsp.Results.Columns[0].Name)
		require.Equal(t, DASHBOARD_VIEWS_LAST_1_DAYS, rsp.Results.Columns[1].Name)

		// sorted descending so should start with highest dashboard_views_last_1_days (100)
		val, err := resource.DecodeCell(rsp.Results.Columns[1], 0, rsp.Results.Rows[0].Cells[1])
		require.NoError(t, err)
		require.Equal(t, int64(100), val)

		// Now look for repositories
		found, err := index.ListRepositoryObjects(ctx, &resource.ListRepositoryObjectsRequest{
			Name: "repo-1",
		})
		require.NoError(t, err)
		jj, err := json.MarshalIndent(found, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s\n", string(jj))
		require.JSONEq(t, `{
			"items": [
				{
					"object": {
						"namespace": "ns",
						"group": "dashboard.grafana.app",
						"resource": "dashboards",
						"name": "aaa"
					},
					"path": "path/to/aaa.json",
					"hash": "xyz",
					"time": 1609462800000,
					"title": "aaa (dash)",
					"folder": "xxx"
				},
				{
					"object": {
						"namespace": "ns",
						"group": "dashboard.grafana.app",
						"resource": "dashboards",
						"name": "bbb"
					},
					"path": "path/to/bbb.json",
					"hash": "hijk",
					"time": 1640998800000,
					"title": "bbb (dash)",
					"folder": "xxx"
				}
			]
		}`, string(jj))

		counts, err := index.CountRepositoryObjects(ctx)
		require.NoError(t, err)
		jj, err = json.MarshalIndent(counts, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s\n", string(jj))
		require.JSONEq(t, `[
			{
				"repository": "repo-1",
				"group": "dashboard.grafana.app",
				"resource": "dashboards",
				"count": 2
			},
			{
				"repository": "repo2",
				"group": "dashboard.grafana.app",
				"resource": "dashboards",
				"count": 1
			}
		]`, string(jj))
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
					Group:     "folder.grafana.app",
					Resource:  "folders",
				},
				Title:     "zzz (folder)",
				TitleSort: "zzz (folder)",
				RepoInfo: &utils.ResourceRepositoryInfo{
					Name:      "repo-1",
					Path:      "path/to/folder.json",
					Hash:      "xxxx",
					Timestamp: asTimePointer(300),
				},
			})
			_ = index.Write(&resource.IndexableDocument{
				RV: 2,
				Key: &resource.ResourceKey{
					Name:      "yyy",
					Namespace: "ns",
					Group:     "folder.grafana.app",
					Resource:  "folders",
				},
				Title:     "yyy (folder)",
				TitleSort: "yyy (folder)",
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

func TestToBleveSearchRequest(t *testing.T) {
	t.Run("will prepend 'fields.' to all dashboard fields", func(t *testing.T) {
		fields := []string{"title", "name", "folder"}
		fields = append(fields, DashboardFields()...)
		resReq := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{},
			Fields:  fields,
		}
		bleveReq, err := toBleveSearchRequest(resReq, nil)
		if err != nil {
			t.Fatalf("error creating bleve search request: %v", err)
		}

		require.Equal(t, len(fields), len(bleveReq.Fields))
		for _, field := range DashboardFields() {
			require.True(t, slices.Contains(bleveReq.Fields, "fields."+field))
		}
		require.Contains(t, bleveReq.Fields, "title")
		require.Contains(t, bleveReq.Fields, "name")
		require.Contains(t, bleveReq.Fields, "folder")
	})
}

func asTimePointer(milli int64) *time.Time {
	if milli > 0 {
		t := time.UnixMilli(milli)
		return &t
	}
	return nil
}
