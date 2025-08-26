package search

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	authlib "github.com/grafana/authlib/types"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.uber.org/atomic"
	"go.uber.org/goleak"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/tracing"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// This verifies that we close all indexes properly and shutdown all background goroutines from our tests.
// (Except for goroutines running specific functions. If possible we should fix this, esp. our own updateIndexSizeMetric.)
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m,
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.(*eventExecutor).startEventListener.func1.1"),
		goleak.IgnoreTopFunction("go.opencensus.io/stats/view.(*worker).start"),
		goleak.IgnoreTopFunction("github.com/blevesearch/bleve_index_api.AnalysisWorker"),                                       // These don't stop when index is closed.
		goleak.IgnoreAnyFunction("github.com/grafana/grafana/pkg/storage/unified/search.(*bleveBackend).updateIndexSizeMetric"), // We don't have a way to stop this one yet.
	)
}

func TestBleveBackend(t *testing.T) {
	dashboardskey := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}
	folderKey := &resourcepb.ResourceKey{
		Namespace: dashboardskey.Namespace,
		Group:     "folder.grafana.app",
		Resource:  "folders",
	}
	tmpdir, err := os.MkdirTemp("", "grafana-bleve-test")
	require.NoError(t, err)

	backend, err := NewBleveBackend(BleveOptions{
		Root:          tmpdir,
		FileThreshold: 5, // with more than 5 items we create a file on disk
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), nil)
	require.NoError(t, err)

	t.Cleanup(backend.CloseAllIndexes)

	rv := int64(10)
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
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
		}, 2, rv, info.Fields, "test", func(index resource.ResourceIndex) (int64, error) {
			err := index.BulkIndex(&resource.BulkIndexRequest{
				Items: []*resource.BulkIndexItem{
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV:   1,
							Name: "aaa",
							Key: &resourcepb.ResourceKey{
								Name:      "aaa",
								Namespace: "ns",
								Group:     "dashboard.grafana.app",
								Resource:  "dashboards",
							},
							Title:  "aaa (dash)",
							Folder: "xxx",
							Fields: map[string]any{
								DASHBOARD_PANEL_TYPES:       []string{"timeseries", "table"},
								DASHBOARD_ERRORS_TODAY:      25,
								DASHBOARD_VIEWS_LAST_1_DAYS: 50,
							},
							Labels: map[string]string{
								utils.LabelKeyDeprecatedInternalID: "10", // nolint:staticcheck
							},
							Tags: []string{"aa", "bb"},
							Manager: &utils.ManagerProperties{
								Kind:     utils.ManagerKindRepo,
								Identity: "repo-1",
							},
							Source: &utils.SourceProperties{
								Path:            "path/to/aaa.json",
								Checksum:        "xyz",
								TimestampMillis: 1609462800000, // 2021
							},
						},
					},
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV:   2,
							Name: "bbb",
							Key: &resourcepb.ResourceKey{
								Name:      "bbb",
								Namespace: "ns",
								Group:     "dashboard.grafana.app",
								Resource:  "dashboards",
							},
							Title:  "bbb (dash)",
							Folder: "xxx",
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
							Manager: &utils.ManagerProperties{
								Kind:     utils.ManagerKindRepo,
								Identity: "repo-1",
							},
							Source: &utils.SourceProperties{
								Path:            "path/to/bbb.json",
								Checksum:        "hijk",
								TimestampMillis: 1640998800000, // 2022
							},
						},
					},
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV: 3,
							Key: &resourcepb.ResourceKey{
								Name:      "ccc",
								Namespace: "ns",
								Group:     "dashboard.grafana.app",
								Resource:  "dashboards",
							},
							Name:   "ccc",
							Title:  "ccc (dash)",
							Folder: "zzz",
							Manager: &utils.ManagerProperties{
								Kind:     utils.ManagerKindRepo,
								Identity: "repo2",
							},
							Source: &utils.SourceProperties{
								Path: "path/in/repo2.yaml",
							},
							Fields: map[string]any{},
							Tags:   []string{"aa"},
							Labels: map[string]string{
								"region": "west",
							},
						},
					},
				},
			})
			if err != nil {
				return 0, err
			}
			return rv, nil
		}, nil, false, false)
		require.NoError(t, err)
		require.NotNil(t, index)
		dashboardsIndex = index

		rsp, err := index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
			},
			Limit: 100000,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: resource.SEARCH_FIELD_TITLE, Desc: true}, // ccc,bbb,aaa
			},
			Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
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

		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
				Labels: []*resourcepb.Requirement{{
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

		// can get sprinkles fields and sort by them
		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
			},
			Limit:  100000,
			Fields: []string{DASHBOARD_ERRORS_TODAY, DASHBOARD_VIEWS_LAST_1_DAYS, "fieldThatDoesntExist"},
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
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

		// check auth will exclude results we don't have access to
		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": false}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
			},
			Limit:  100000,
			Fields: []string{DASHBOARD_ERRORS_TODAY, DASHBOARD_VIEWS_LAST_1_DAYS, "fieldThatDoesntExist"},
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "fields." + DASHBOARD_VIEWS_LAST_1_DAYS, Desc: true},
			},
		}, nil)
		require.NoError(t, err)
		require.Equal(t, 0, len(rsp.Results.Rows))

		// Now look for repositories
		found, err := index.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
			Kind: "repo",
			Id:   "repo-1",
		})
		require.NoError(t, err)
		jj, err := json.MarshalIndent(found, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s\n", string(jj))
		// NOTE "hash" -> "checksum" requires changing the protobuf
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

		counts, err := index.CountManagedObjects(ctx)
		require.NoError(t, err)
		jj, err = json.MarshalIndent(counts, "", "  ")
		require.NoError(t, err)
		fmt.Printf("%s\n", string(jj))
		require.JSONEq(t, `[
			{
				"kind": "repo",
				"id": "repo-1",
				"group": "dashboard.grafana.app",
				"resource": "dashboards",
				"count": 2
			},
			{
				"kind": "repo",
				"id": "repo2",
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
		}, 2, rv, fields, "test", func(index resource.ResourceIndex) (int64, error) {
			err := index.BulkIndex(&resource.BulkIndexRequest{
				Items: []*resource.BulkIndexItem{
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV: 1,
							Key: &resourcepb.ResourceKey{
								Name:      "zzz",
								Namespace: "ns",
								Group:     "folder.grafana.app",
								Resource:  "folders",
							},
							Title: "zzz (folder)",
							Manager: &utils.ManagerProperties{
								Kind:     utils.ManagerKindRepo,
								Identity: "repo-1",
							},
							Source: &utils.SourceProperties{
								Path:            "path/to/folder.json",
								Checksum:        "xxxx",
								TimestampMillis: 300,
							},
							Labels: map[string]string{
								utils.LabelKeyDeprecatedInternalID: "123",
							},
						},
					},
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							RV: 2,
							Key: &resourcepb.ResourceKey{
								Name:      "yyy",
								Namespace: "ns",
								Group:     "folder.grafana.app",
								Resource:  "folders",
							},
							Title: "yyy (folder)",
							Labels: map[string]string{
								"region":                           "west",
								utils.LabelKeyDeprecatedInternalID: "321",
							},
						},
					},
				},
			})
			if err != nil {
				return 0, err
			}
			return rv, nil
		}, nil, false, false)
		require.NoError(t, err)
		require.NotNil(t, index)
		foldersIndex = index

		rsp, err := index.Search(ctx, NewStubAccessClient(map[string]bool{"folders": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
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
		rsp, err := dashboardsIndex.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: dashboardskey,
			},
			Fields: []string{
				"title", "_id",
			},
			Federated: []*resourcepb.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
			Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
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

		// now only when we have permissions to see dashboards
		rsp, err = dashboardsIndex.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true, "folders": false}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: dashboardskey,
			},
			Fields: []string{
				"title", "_id",
			},
			Federated: []*resourcepb.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
			Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
				"region": {
					Field: "labels.region",
					Limit: 100,
				},
			},
		}, []resource.ResourceIndex{foldersIndex}) // << note the folder index matches the federation request

		require.NoError(t, err)
		require.Equal(t, 3, len(rsp.Results.Rows))
		require.Equal(t, "dashboards", rsp.Results.Rows[0].Key.Resource)
		require.Equal(t, "dashboards", rsp.Results.Rows[1].Key.Resource)
		require.Equal(t, "dashboards", rsp.Results.Rows[2].Key.Resource)

		// now only when we have permissions to see folders
		rsp, err = dashboardsIndex.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": false, "folders": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: dashboardskey,
			},
			Fields: []string{
				"title", "_id",
			},
			Federated: []*resourcepb.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
			Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
				"region": {
					Field: "labels.region",
					Limit: 100,
				},
			},
		}, []resource.ResourceIndex{foldersIndex}) // << note the folder index matches the federation request

		require.NoError(t, err)
		require.Equal(t, 2, len(rsp.Results.Rows))
		require.Equal(t, "folders", rsp.Results.Rows[0].Key.Resource)
		require.Equal(t, "folders", rsp.Results.Rows[1].Key.Resource)

		// now when we have permissions to see nothing
		rsp, err = dashboardsIndex.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": false, "folders": false}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: dashboardskey,
			},
			Fields: []string{
				"title", "_id",
			},
			Federated: []*resourcepb.ResourceKey{
				folderKey, // This will join in the
			},
			Limit: 100000,
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "title", Desc: false},
			},
			Facet: map[string]*resourcepb.ResourceSearchRequest_Facet{
				"region": {
					Field: "labels.region",
					Limit: 100,
				},
			},
		}, []resource.ResourceIndex{foldersIndex}) // << note the folder index matches the federation request

		require.NoError(t, err)
		require.Equal(t, 0, len(rsp.Results.Rows))
	})
}

func TestGetSortFields(t *testing.T) {
	t.Run("will prepend 'fields.' to sort fields when they are dashboard fields", func(t *testing.T) {
		searchReq := &resourcepb.ResourceSearchRequest{
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "views_total", Desc: false},
			},
		}
		sortFields := getSortFields(searchReq)
		assert.Equal(t, []string{"fields.views_total"}, sortFields)
	})
	t.Run("will prepend sort fields with a '-' when sort is Desc", func(t *testing.T) {
		searchReq := &resourcepb.ResourceSearchRequest{
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "views_total", Desc: true},
			},
		}
		sortFields := getSortFields(searchReq)
		assert.Equal(t, []string{"-fields.views_total"}, sortFields)
	})
	t.Run("will not prepend 'fields.' to common fields", func(t *testing.T) {
		searchReq := &resourcepb.ResourceSearchRequest{
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "description", Desc: false},
			},
		}
		sortFields := getSortFields(searchReq)
		assert.Equal(t, []string{"description"}, sortFields)
	})
}

var _ authlib.AccessClient = (*StubAccessClient)(nil)

func NewStubAccessClient(permissions map[string]bool) *StubAccessClient {
	return &StubAccessClient{resourceResponses: permissions}
}

type StubAccessClient struct {
	resourceResponses map[string]bool // key is the resource name, and bool if what the checker will return
}

func (nc *StubAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: nc.resourceResponses[req.Resource]}, nil
}

func (nc *StubAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, error) {
	return func(name, folder string) bool {
		return nc.resourceResponses[req.Resource]
	}, nil
}

func (nc StubAccessClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return nil, nil
}

func (nc StubAccessClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	return nil
}

func (nc StubAccessClient) BatchCheck(ctx context.Context, req *authzextv1.BatchCheckRequest) (*authzextv1.BatchCheckResponse, error) {
	return nil, nil
}

func TestSafeInt64ToInt(t *testing.T) {
	tests := []struct {
		name    string
		input   int64
		want    int
		wantErr bool
	}{
		{
			name:  "Valid int64 within int range",
			input: 42,
			want:  42,
		},
		{
			name:    "Overflow int64 value",
			input:   math.MaxInt64,
			want:    0,
			wantErr: true,
		},
		{
			name:    "Underflow int64 value",
			input:   math.MinInt64,
			want:    0,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := safeInt64ToInt(tt.input)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.Equal(t, tt.want, got)
		})
	}
}

func Test_isPathWithinRoot(t *testing.T) {
	tests := []struct {
		name string
		dir  string
		root string
		want bool
	}{
		{
			name: "valid path",
			dir:  "/path/to/my-file/",
			root: "/path/to/",
			want: true,
		},
		{
			name: "valid path without trailing slash",
			dir:  "/path/to/my-file",
			root: "/path/to",
			want: true,
		},
		{
			name: "path with double slashes",
			dir:  "/path//to//my-file/",
			root: "/path/to/",
			want: true,
		},
		{
			name: "invalid path: ..",
			dir:  "/path/../above/",
			root: "/path/to/",
		},
		{
			name: "invalid path: \\",
			dir:  "\\path/to",
			root: "/path/to/",
		},
		{
			name: "invalid path: not under safe dir",
			dir:  "/path/to.txt",
			root: "/path/to/",
		},
		{
			name: "invalid path: empty paths",
			dir:  "",
			root: "/path/to/",
		},
		{
			name: "invalid path: different path",
			dir:  "/other/path/to/my-file/",
			root: "/Some/other/path",
		},
		{
			name: "invalid path: empty safe path",
			dir:  "/path/to/",
			root: "",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, isPathWithinRoot(tt.dir, tt.root))
		})
	}
}

func setupBleveBackend(t *testing.T, fileThreshold int, cacheTTL time.Duration, dir string) (*bleveBackend, prometheus.Gatherer) {
	if dir == "" {
		dir = t.TempDir()
	}
	reg := prometheus.NewRegistry()
	metrics := resource.ProvideIndexMetrics(reg)

	backend, err := NewBleveBackend(BleveOptions{
		Root:             dir,
		FileThreshold:    int64(fileThreshold),
		IndexCacheTTL:    cacheTTL,
	}, tracing.NewNoopTracerService(), featuremgmt.WithFeatures(), metrics)
	require.NoError(t, err)
	require.NotNil(t, backend)
	t.Cleanup(backend.CloseAllIndexes)
	return backend, reg
}

func TestBleveInMemoryIndexExpiration(t *testing.T) {
	backend, reg := setupBleveBackend(t, 5, time.Nanosecond, "")

	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	builtIndex, err := backend.BuildIndex(context.Background(), ns, 1 /* below FileThreshold */, 100, nil, "test", indexTestDocs(ns, 1, 100), nil, false, false)
	require.NoError(t, err)

	// Wait for index expiration, which is 1ns
	time.Sleep(10 * time.Millisecond)
	idx, err := backend.GetIndex(context.Background(), ns)
	require.NoError(t, err)
	require.Nil(t, idx)

	// Verify that builtIndex is now closed.
	_, err = builtIndex.DocCount(context.Background(), "")
	require.ErrorIs(t, err, bleve.ErrorIndexClosed)

	// Verify that there are no open indexes.
	require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))
}

func TestBleveFileIndexExpiration(t *testing.T) {
	backend, reg := setupBleveBackend(t, 5, time.Nanosecond, "")

	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	// size=100 is above FileThreshold, this will be file-based index
	builtIndex, err := backend.BuildIndex(context.Background(), ns, 100, 100, nil, "test", indexTestDocs(ns, 1, 100), nil, false, false)
	require.NoError(t, err)

	// Wait for index expiration, which is 1ns
	time.Sleep(10 * time.Millisecond)
	idx, err := backend.GetIndex(context.Background(), ns)
	require.NoError(t, err)
	require.NotNil(t, idx)

	// Verify that builtIndex is still open.
	cnt, err := builtIndex.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))
}

func TestFileIndexIsReusedOnSameSizeAndRVLessThanIndexRV(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, reg1 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, false, false)
	require.NoError(t, err)

	// Verify one open index.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend1.CloseAllIndexes()

	// Verify that there are no open indexes after CloseAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We open new backend using same directory, and run indexing with same size (10) and RV (100). This should reuse existing index, and skip indexing.
	backend2, reg2 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 1000, 100), nil, false, false)
	require.NoError(t, err)

	// Verify that we're reusing existing index and there is only 10 documents in it, not 1000.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(10), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend2.CloseAllIndexes()
	// Verify that there are no open indexes after closeAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We repeat with backend3 and RV 99. This should also reuse existing index and skip indexing
	backend3, reg3 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend3.BuildIndex(context.Background(), ns, 10 /* file based */, 99, nil, "test", indexTestDocs(ns, 1000, 99), nil, false, false)
	require.NoError(t, err)

	// Verify that we're reusing existing index and there is only 10 documents in it, not 1000.
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(10), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg3, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend3.CloseAllIndexes()

	require.NoError(t, testutil.GatherAndCompare(reg3, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// again now RV > 100. Should NOT reuse index
	backend4, reg4 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend4.BuildIndex(context.Background(), ns, 10 /* file based */, 101, nil, "test", indexTestDocs(ns, 1000, 100), nil, false, false)
	require.NoError(t, err)

	// Verify that we're NOT existing index and there is only 1000 documents in it, not 10.
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1000), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg4, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend4.CloseAllIndexes()
}

func TestFileIndexIsIgnoredIfRebuildFlagIsTrueWithoutSearchAfterWrite(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, reg1 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, true, false)
	require.NoError(t, err)

	// Verify one open index.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend1.CloseAllIndexes()

	// Verify that there are no open indexes after CloseAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We open new backend using same directory, and run indexing with same size (10) and RV (100). This should NOT
	// reuse existing index, due to the rebuild flag being true
	backend2, reg2 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 1000, 100), nil, true, false)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1000 documents, not 10.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1000), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend2.CloseAllIndexes()
	// Verify that there are no open indexes after closeAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We repeat with backend3 and RV 99. This should also NOT reuse existing index
	backend3, reg3 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend3.BuildIndex(context.Background(), ns, 10 /* file based */, 99, nil, "test", indexTestDocs(ns, 1001, 99), nil, true, false)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1001 documents
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1001), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg3, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend3.CloseAllIndexes()

	// again now RV > 100. Should still rebuild the index due to the rebuild flag
	backend4, reg4 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend4.BuildIndex(context.Background(), ns, 10 /* file based */, 101, nil, "test", indexTestDocs(ns, 1002, 100), nil, true, false)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1002 documents
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1002), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg4, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend4.CloseAllIndexes()
}

func TestFileIndexIsIgnoredIfRebuildFlagIsTrueWithSearchAfterWrite(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, reg1 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, true, true)
	require.NoError(t, err)

	// Verify one open index.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend1.CloseAllIndexes()

	// Verify that there are no open indexes after CloseAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We open new backend using same directory, and run indexing with same size (10) and RV (100). This should NOT
	// reuse existing index, due to the rebuild flag being true
	backend2, reg2 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 1000, 100), nil, true, true)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1000 documents, not 10.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1000), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend2.CloseAllIndexes()
	// Verify that there are no open indexes after closeAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We repeat with backend3 and RV 99. This should also NOT reuse existing index
	backend3, reg3 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend3.BuildIndex(context.Background(), ns, 10 /* file based */, 99, nil, "test", indexTestDocs(ns, 1001, 99), nil, true, true)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1001 documents
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1001), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg3, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend3.CloseAllIndexes()

	// again now RV > 100. Should still rebuild the index due to the rebuild flag
	backend4, reg4 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend4.BuildIndex(context.Background(), ns, 10 /* file based */, 101, nil, "test", indexTestDocs(ns, 1002, 100), nil, true, true)
	require.NoError(t, err)

	// Verify that we've re-built the index. There should be 1002 documents
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(1002), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg4, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend4.CloseAllIndexes()
}

func TestFileIndexIsReusedIfRVisPresentAndSearhAfterWriteIsEnabled(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, reg1 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, false, true)
	require.NoError(t, err)

	// Verify one open index.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend1.CloseAllIndexes()

	// Verify that there are no open indexes after CloseAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg1, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We open new backend using same directory, and run indexing with same size (10) and RV (100). This should reuse existing index, and skip indexing.
	backend2, reg2 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 1000, 100), nil, false, true)
	require.NoError(t, err)

	// Verify that we're reusing existing index and there is only 10 documents in it, not 1000.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(10), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend2.CloseAllIndexes()
	// Verify that there are no open indexes after closeAllIndexes call.
	require.NoError(t, testutil.GatherAndCompare(reg2, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 0
	`), "index_server_open_indexes"))

	// We repeat with backend3 and RV 99. This should also reuse existing index and skip indexing
	backend3, reg3 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend3.BuildIndex(context.Background(), ns, 10 /* file based */, 99, nil, "test", indexTestDocs(ns, 1000, 99), nil, false, true)
	require.NoError(t, err)

	// Verify that we're reusing existing index and there is only 10 documents in it, not 1000.
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(10), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg3, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend3.CloseAllIndexes()

	// again now RV > 100. Should still reuse index
	backend4, reg4 := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err = backend4.BuildIndex(context.Background(), ns, 10 /* file based */, 101, nil, "test", indexTestDocs(ns, 1000, 100), nil, false, true)
	require.NoError(t, err)

	// Verify that we're reusing existing index and there is only 10 documents in it, not 1000.
	cnt, err = idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(10), cnt)

	require.NoError(t, testutil.GatherAndCompare(reg4, bytes.NewBufferString(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} 0
		index_server_open_indexes{index_storage="file"} 1
	`), "index_server_open_indexes"))

	backend4.CloseAllIndexes()
}

func TestFileIndexIsNotReusedOnDifferentSize(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, _ := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, false, false)
	require.NoError(t, err)
	backend1.CloseAllIndexes()

	// We open new backend using same directory, but with different size. Index should be rebuilt.
	backend2, _ := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 100, 100, nil, "test", indexTestDocs(ns, 100, 100), nil, false, false)
	require.NoError(t, err)

	// Verify that index has updated number of documents.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(100), cnt)
}

func TestFileIndexIsNotReusedOnDifferentRV(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	backend1, _ := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	_, err := backend1.BuildIndex(context.Background(), ns, 10, 100, nil, "test", indexTestDocs(ns, 10, 100), nil, false, false)
	require.NoError(t, err)
	backend1.CloseAllIndexes()

	// We open new backend using same directory, but with different RV. Index should be rebuilt.
	backend2, _ := setupBleveBackend(t, 5, time.Nanosecond, tmpDir)
	idx, err := backend2.BuildIndex(context.Background(), ns, 10 /* file based */, 999999, nil, "test", indexTestDocs(ns, 100, 999999), nil, false, false)
	require.NoError(t, err)

	// Verify that index has updated number of documents.
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	require.Equal(t, int64(100), cnt)
}

func TestRebuildingIndexClosesPreviousCachedIndex(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	for name, testCase := range map[string]struct {
		firstInMemory  bool
		secondInMemory bool
	}{
		"in-memory, in-memory": {true, true},
		"in-memory, file":      {true, false},
		"file, in-memory":      {false, true},
		"file, file":           {false, false},
	} {
		t.Run(name, func(t *testing.T) {
			backend, reg := setupBleveBackend(t, 5, time.Nanosecond, "")

			firstSize := 100
			if testCase.firstInMemory {
				firstSize = 1
			}
			firstIndex, err := backend.BuildIndex(context.Background(), ns, int64(firstSize), 100, nil, "test", indexTestDocs(ns, firstSize, 100), nil, false, false)
			require.NoError(t, err)

			if testCase.firstInMemory {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 0)
			} else {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 1)
			}

			openInMemoryIndexes := 0

			secondSize := 100
			if testCase.secondInMemory {
				secondSize = 1
				openInMemoryIndexes = 1
			}
			secondIndex, err := backend.BuildIndex(context.Background(), ns, int64(secondSize), 100, nil, "test", indexTestDocs(ns, secondSize, 100), nil, false, false)
			require.NoError(t, err)

			if testCase.secondInMemory {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 0)
			} else {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 1)
			}

			// Verify that first and second index are different, and first one is now closed.
			require.NotEqual(t, firstIndex, secondIndex)

			_, err = firstIndex.DocCount(context.Background(), "")
			require.ErrorIs(t, err, bleve.ErrorIndexClosed)

			cnt, err := secondIndex.DocCount(context.Background(), "")
			require.NoError(t, err)
			require.Equal(t, int64(secondSize), cnt)

			require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(fmt.Sprintf(`
				# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
				# TYPE index_server_open_indexes gauge
				index_server_open_indexes{index_storage="memory"} %d
				index_server_open_indexes{index_storage="file"} %d
			`, openInMemoryIndexes, 1-openInMemoryIndexes)), "index_server_open_indexes"))
		})
	}
}

func verifyDirEntriesCount(t *testing.T, dir string, count int) {
	ents, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			ents = nil
			// This is fine, if dir doesn't exist.
		} else {
			require.NoError(t, err)
		}
	}
	require.Len(t, ents, count)
}

func indexTestDocs(ns resource.NamespacedResource, docs int, listRV int64) resource.BuildFn {
	return func(index resource.ResourceIndex) (int64, error) {
		var items []*resource.BulkIndexItem
		for i := 0; i < docs; i++ {
			items = append(items, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key: &resourcepb.ResourceKey{
						Namespace: ns.Namespace,
						Group:     ns.Group,
						Resource:  ns.Resource,
						Name:      fmt.Sprintf("doc%d", i),
					},
					Title: fmt.Sprintf("Document %d", i),
				},
			})
		}

		err := index.BulkIndex(&resource.BulkIndexRequest{Items: items})
		return listRV, err
	}
}

func updateTestDocs(ns resource.NamespacedResource, docs int) resource.UpdateFn {
	cnt := 0

	return func(context context.Context, index resource.ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error) {
		cnt++

		var items []*resource.BulkIndexItem
		for i := 0; i < docs; i++ {
			items = append(items, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key: &resourcepb.ResourceKey{
						Namespace: ns.Namespace,
						Group:     ns.Group,
						Resource:  ns.Resource,
						Name:      fmt.Sprintf("doc%d", i),
					},
					Title: fmt.Sprintf("Document %d (gen_%d)", i, cnt),
				},
			})
		}

		err := index.BulkIndex(&resource.BulkIndexRequest{Items: items})
		// Simulate RV increase
		return sinceRV + int64(docs), docs, err
	}
}

func TestCleanOldIndexes(t *testing.T) {
	dir := t.TempDir()

	b, _ := setupBleveBackend(t, 5, time.Nanosecond, dir)

	t.Run("with skip", func(t *testing.T) {
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-1/a"), 0750))
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-2/b"), 0750))
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-3/c"), 0750))

		b.cleanOldIndexes(dir, "index-2")
		files, err := os.ReadDir(dir)
		require.NoError(t, err)
		require.Len(t, files, 1)
		require.Equal(t, "index-2", files[0].Name())
	})

	t.Run("without skip", func(t *testing.T) {
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-1/a"), 0750))
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-2/b"), 0750))
		require.NoError(t, os.MkdirAll(filepath.Join(dir, "index-3/c"), 0750))

		b.cleanOldIndexes(dir, "")
		files, err := os.ReadDir(dir)
		require.NoError(t, err)
		require.Len(t, files, 0)
	})
}

func TestBleveIndexWithFailures(t *testing.T) {
	t.Run("in-memory index", func(t *testing.T) {
		testBleveIndexWithFailures(t, false)
	})
	t.Run("file-based index", func(t *testing.T) {
		testBleveIndexWithFailures(t, true)
	})
}

func testBleveIndexWithFailures(t *testing.T, fileBased bool) {
	backend, _ := setupBleveBackend(t, 5, time.Nanosecond, "")

	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	size := int64(1)
	if fileBased {
		// size=100 is above FileThreshold (5), make it a file-based index.
		size = 100
	}
	_, err := backend.BuildIndex(context.Background(), ns, size, 100, nil, "test", func(index resource.ResourceIndex) (int64, error) {
		return 0, fmt.Errorf("fail")
	}, nil, false, false)
	require.Error(t, err)

	// Even though previous build of the index failed, new building of the index should work.
	_, err = backend.BuildIndex(context.Background(), ns, size, 100, nil, "test", indexTestDocs(ns, int(size), 100), nil, false, false)
	require.NoError(t, err)
}

func TestIndexUpdate(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, 5, 1*time.Minute, "")
	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, false)
	require.NoError(t, err)

	resp := searchTitle(t, idx, "gen", 10, ns)
	require.Equal(t, int64(0), resp.TotalHits)

	// Update index.
	_, err = idx.UpdateIndex(context.Background(), "test")
	require.NoError(t, err)

	// Verify that index was updated -- number of docs didn't change, but we can search "gen_1" documents now.
	require.Equal(t, 10, docCount(t, idx))
	require.Equal(t, int64(5), searchTitle(t, idx, "gen_1", 10, ns).TotalHits)

	// Update index again.
	_, err = idx.UpdateIndex(context.Background(), "test")
	require.NoError(t, err)
	// Verify that index was updated again -- we can search "gen_2" now. "gen_1" documents are gone.
	require.Equal(t, 10, docCount(t, idx))
	require.Equal(t, int64(0), searchTitle(t, idx, "gen_1", 10, ns).TotalHits)
	require.Equal(t, int64(5), searchTitle(t, idx, "gen_2", 10, ns).TotalHits)
}

func TestConcurrentIndexUpdateAndBuildIndex(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, 5, 1*time.Minute, "", false)

	updaterFn := func(context context.Context, index resource.ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error) {
		var items []*resource.BulkIndexItem
		for i := 0; i < 5; i++ {
			items = append(items, &resource.BulkIndexItem{
				Action: resource.ActionIndex,
				Doc: &resource.IndexableDocument{
					Key: &resourcepb.ResourceKey{
						Namespace: ns.Namespace,
						Group:     ns.Group,
						Resource:  ns.Resource,
						Name:      fmt.Sprintf("doc%d", i),
					},
					Title: fmt.Sprintf("Document %d (gen_%d)", i, 5),
				},
			})
		}

		err := index.BulkIndex(&resource.BulkIndexRequest{Items: items})
		// Simulate RV increase
		return sinceRV + int64(5), 5, err
	}

	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, false)
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	_, err = idx.UpdateIndex(ctx, "test")
	require.NoError(t, err)

	_, err = be.BuildIndex(t.Context(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, false)
	require.NoError(t, err)

	_, err = idx.UpdateIndex(ctx, "test")
	require.Contains(t, err.Error(), bleve.ErrorIndexClosed.Error())
}

func TestConcurrentIndexUpdateSearchAndRebuild(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, 5, 1*time.Minute, "")

	_, err := be.BuildIndex(t.Context(), ns, 10, 0, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, false)
	require.NoError(t, err)

	wg := sync.WaitGroup{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	rebuilds := atomic.NewInt64(0)
	updates := atomic.NewInt64(0)
	searches := atomic.NewInt64(0)
	const searchConcurrency = 25
	for i := 0; i < searchConcurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			for ctx.Err() == nil {
				select {
				case <-ctx.Done():
					return
				case <-time.After(time.Duration(i) * time.Millisecond): // introduce small jitter
				}

				idx, err := be.GetIndex(ctx, ns)
				require.NoError(t, err) // GetIndex doesn't really return error.

				_, err = idx.UpdateIndex(ctx, "test")
				if err != nil {
					if errors.Is(err, bleve.ErrorIndexClosed) || errors.Is(err, context.Canceled) {
						continue
					}
					require.NoError(t, err)
				}
				updates.Inc()

				resp, err := idx.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
					Options: &resourcepb.ListOptions{
						Key: &resourcepb.ResourceKey{
							Namespace: ns.Namespace,
							Group:     ns.Group,
							Resource:  ns.Resource,
						},
					},
					Fields: []string{"title"},
					Query:  "Document",
					Limit:  10,
				}, nil)
				if err != nil {
					if errors.Is(err, bleve.ErrorIndexClosed) || errors.Is(err, context.Canceled) {
						continue
					}
					require.NoError(t, err)
				}
				require.Equal(t, int64(10), resp.TotalHits)
				searches.Inc()
			}
		}()
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		for ctx.Err() == nil {
			_, err := be.BuildIndex(t.Context(), ns, 10, 0, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, false)
			require.NoError(t, err)
			rebuilds.Inc()
		}
	}()

	time.Sleep(5 * time.Second)
	cancel()
	wg.Wait()

	fmt.Println("Updates:", updates.Load(), "searches:", searches.Load(), "rebuilds:", rebuilds.Load())
}

// Verify concurrent updates and searches work as expected.
func TestConcurrentIndexUpdateAndSearch(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, 5, 1*time.Minute, "")

	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, false)
	require.NoError(t, err)

	wg := sync.WaitGroup{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// We count how many goroutines received given updated RV. We expect at least some RVs to be returned to multiple
	// goroutines, if batching works.
	mu := sync.Mutex{}
	updatedRVs := map[int64]int{}

	const searchConcurrency = 25
	for i := 0; i < searchConcurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			prevRV := int64(0)
			for ctx.Err() == nil {
				// We use t.Context() here to avoid getting errors from context cancellation.
				rv, err := idx.UpdateIndex(t.Context(), "test")
				require.NoError(t, err)
				require.Greater(t, rv, prevRV) // Each update should return new RV (that's how our update function works)
				require.Equal(t, int64(10), searchTitle(t, idx, "Document", 10, ns).TotalHits)
				prevRV = rv

				mu.Lock()
				updatedRVs[rv]++
				mu.Unlock()
			}
		}()
	}

	time.Sleep(1 * time.Second)
	cancel()
	wg.Wait()

	// Check that some RVs were updated due to requests from multiple goroutines
	var rvUpdatedByMultipleGoroutines int64
	for rv, count := range updatedRVs {
		if count > 1 {
			rvUpdatedByMultipleGoroutines = rv
			break
		}
	}
	require.Greater(t, rvUpdatedByMultipleGoroutines, int64(0))
}

// Verify concurrent updates and searches work as expected.
func TestIndexUpdateWithErrors(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, 5, 1*time.Minute, "")

	updateErr := fmt.Errorf("failed to update index")
	updaterFn := func(context context.Context, index resource.ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error) {
		time.Sleep(100 * time.Millisecond)
		return 0, 0, updateErr
	}
	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, 100, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, false)
	require.NoError(t, err)

	t.Run("update fail", func(t *testing.T) {
		_, err = idx.UpdateIndex(t.Context(), "test")
		require.ErrorIs(t, err, updateErr)
	})

	t.Run("update timeout", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
		defer cancel()

		_, err = idx.UpdateIndex(ctx, "test")
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})

	t.Run("context canceled", func(t *testing.T) {
		// Canceled context
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		_, err = idx.UpdateIndex(ctx, "test")
		require.ErrorIs(t, err, context.Canceled)
	})
}

func searchTitle(t *testing.T, idx resource.ResourceIndex, query string, limit int, ns resource.NamespacedResource) *resourcepb.ResourceSearchResponse {
	resp, err := idx.Search(t.Context(), nil, &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: ns.Namespace,
				Group:     ns.Group,
				Resource:  ns.Resource,
			},
		},
		Fields: []string{"title"},
		Query:  query,
		Limit:  int64(limit),
	}, nil)
	require.NoError(t, err)
	return resp
}

func docCount(t *testing.T, idx resource.ResourceIndex) int {
	cnt, err := idx.DocCount(context.Background(), "")
	require.NoError(t, err)
	return int(cnt)
}
