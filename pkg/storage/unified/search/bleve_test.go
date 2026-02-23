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
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	bolterrors "go.etcd.io/bbolt/errors"
	"go.uber.org/atomic"
	"go.uber.org/goleak"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/services/store/kind/dashboard"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// This verifies that we close all indexes properly and shutdown all background goroutines from our tests.
// (Except for goroutines running specific functions. If possible we should fix this, esp. our own updateIndexSizeMetric.)
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m,
		goleak.IgnoreTopFunction("github.com/open-feature/go-sdk/openfeature.(*eventExecutor).startEventListener.func1.1"),
		goleak.IgnoreTopFunction("github.com/blevesearch/bleve_index_api.AnalysisWorker"), // These don't stop when index is closed.
	)
}

func TestBleveBackend(t *testing.T) {
	tmpdir, err := os.MkdirTemp("", "grafana-bleve-test")
	require.NoError(t, err)

	backend, err := NewBleveBackend(BleveOptions{
		Root:          tmpdir,
		FileThreshold: 5, // with more than 5 items we create a file on disk
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	testBleveBackend(t, backend)
}

func testBleveBackend(t *testing.T, backend *bleveBackend) {
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

	rv := int64(10)
	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	var dashboardsIndex resource.ResourceIndex
	var foldersIndex resource.ResourceIndex

	t.Run("build dashboards", func(t *testing.T) {
		key := dashboardskey
		info, err := builders.DashboardBuilder(func(ctx context.Context, namespace string, blob resource.BlobSupport) (resource.DocumentBuilder, error) {
			return &builders.DashboardDocumentBuilder{
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
		}, 2, info.Fields, "test", func(index resource.ResourceIndex) (int64, error) {
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
								builders.DASHBOARD_PANEL_TYPES:       []string{"timeseries", "table"},
								builders.DASHBOARD_ERRORS_TODAY:      25,
								builders.DASHBOARD_VIEWS_LAST_1_DAYS: 50,
							},
							Labels: map[string]string{
								utils.LabelKeyDeprecatedInternalID: "10", // nolint:staticcheck
							},
							Tags:            []string{"aa", "bb"},
							OwnerReferences: []string{"iam.grafana.app/Team/engineering"},
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
								builders.DASHBOARD_PANEL_TYPES:       []string{"timeseries"},
								builders.DASHBOARD_ERRORS_TODAY:      40,
								builders.DASHBOARD_VIEWS_LAST_1_DAYS: 100,
							},
							Tags: []string{"aa"},
							Labels: map[string]string{
								"region":                           "east",
								utils.LabelKeyDeprecatedInternalID: "11", // nolint:staticcheck
							},
							OwnerReferences: []string{"iam.grafana.app/Team/marketing", "iam.grafana.app/User/admin"},
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
		}, nil, false, time.Time{})
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
		}, nil, nil)
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

		count, _ := index.DocCount(ctx, "", nil)
		assert.Equal(t, int64(3), count)

		count, _ = index.DocCount(ctx, "zzz", nil)
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
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), rsp.TotalHits)
		require.Equal(t, []string{"aaa", "bbb"}, []string{
			rsp.Results.Rows[0].Key.Name,
			rsp.Results.Rows[1].Key.Name,
		})

		// search by owner reference
		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_OWNER_REFERENCES,
					Operator: "=",
					Values:   []string{"iam.grafana.app/Team/engineering"},
				}},
			},
			Limit: 100000,
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), rsp.TotalHits)
		require.Equal(t, "aaa", rsp.Results.Rows[0].Key.Name)

		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_OWNER_REFERENCES,
					Operator: "=",
					Values:   []string{"iam.grafana.app/Team/marketing"},
				}},
			},
			Limit: 100000,
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(1), rsp.TotalHits)
		require.Equal(t, "bbb", rsp.Results.Rows[0].Key.Name)

		// search by owner reference - multiple values (OR)
		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
				Fields: []*resourcepb.Requirement{{
					Key:      resource.SEARCH_FIELD_OWNER_REFERENCES,
					Operator: "in",
					Values:   []string{"iam.grafana.app/Team/engineering", "iam.grafana.app/User/admin"},
				}},
			},
			Limit: 100000,
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, int64(2), rsp.TotalHits)
		names := []string{rsp.Results.Rows[0].Key.Name, rsp.Results.Rows[1].Key.Name}
		assert.Contains(t, names, "aaa")
		assert.Contains(t, names, "bbb")

		// can get sprinkles fields and sort by them
		rsp, err = index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
			},
			Limit:  100000,
			Fields: []string{builders.DASHBOARD_ERRORS_TODAY, builders.DASHBOARD_VIEWS_LAST_1_DAYS, "fieldThatDoesntExist"},
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "fields." + builders.DASHBOARD_VIEWS_LAST_1_DAYS, Desc: true},
			},
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 2, len(rsp.Results.Columns))
		require.Equal(t, builders.DASHBOARD_ERRORS_TODAY, rsp.Results.Columns[0].Name)
		require.Equal(t, builders.DASHBOARD_VIEWS_LAST_1_DAYS, rsp.Results.Columns[1].Name)
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
			Fields: []string{builders.DASHBOARD_ERRORS_TODAY, builders.DASHBOARD_VIEWS_LAST_1_DAYS, "fieldThatDoesntExist"},
			SortBy: []*resourcepb.ResourceSearchRequest_Sort{
				{Field: "fields." + builders.DASHBOARD_VIEWS_LAST_1_DAYS, Desc: true},
			},
		}, nil, nil)
		require.NoError(t, err)
		require.Equal(t, 0, len(rsp.Results.Rows))

		// Now look for repositories
		found, err := index.ListManagedObjects(ctx, &resourcepb.ListManagedObjectsRequest{
			Kind: "repo",
			Id:   "repo-1",
		}, nil)
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

		counts, err := index.CountManagedObjects(ctx, nil)
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
		}, 2, fields, "test", func(index resource.ResourceIndex) (int64, error) {
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
		}, nil, false, time.Time{})
		require.NoError(t, err)
		require.NotNil(t, index)
		foldersIndex = index

		rsp, err := index.Search(ctx, NewStubAccessClient(map[string]bool{"folders": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: key,
			},
			Limit: 100000,
		}, nil, nil)
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
		}, []resource.ResourceIndex{foldersIndex}, nil) // << note the folder index matches the federation request
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		require.NotNil(t, rsp.Results)
		require.NotNil(t, rsp.Facet)

		// Sorted across two indexes
		sorted := make([]string, 0, len(rsp.Results.Rows))
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
		}, []resource.ResourceIndex{foldersIndex}, nil) // << note the folder index matches the federation request

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
		}, []resource.ResourceIndex{foldersIndex}, nil) // << note the folder index matches the federation request

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
		}, []resource.ResourceIndex{foldersIndex}, nil) // << note the folder index matches the federation request

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

func (nc *StubAccessClient) Check(ctx context.Context, id authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	return authlib.CheckResponse{Allowed: nc.resourceResponses[req.Resource]}, nil
}

func (nc *StubAccessClient) Compile(ctx context.Context, id authlib.AuthInfo, req authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(name, folder string) bool {
		return nc.resourceResponses[req.Resource]
	}, authlib.NoopZookie{}, nil
}

func (nc *StubAccessClient) BatchCheck(ctx context.Context, id authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	return authlib.BatchCheckResponse{}, errors.New("not implemented")
}

func (nc StubAccessClient) Read(ctx context.Context, req *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return nil, nil
}

func (nc StubAccessClient) Write(ctx context.Context, req *authzextv1.WriteRequest) error {
	return nil
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

const (
	buildVersion         = "12.3.45-789"
	defaultFileThreshold = 5
	defaultIndexCacheTTL = 1 * time.Minute
)

func setupBleveBackend(t *testing.T, options ...setupOption) (*bleveBackend, prometheus.Gatherer) {
	reg := prometheus.NewRegistry()
	metrics := resource.ProvideIndexMetrics(reg)

	opts := BleveOptions{
		FileThreshold: defaultFileThreshold,
		IndexCacheTTL: defaultIndexCacheTTL,
		Logger:        log.NewNopLogger(),
		BuildVersion:  buildVersion,
	}
	for _, opt := range options {
		opt(&opts)
	}
	if opts.Root == "" {
		opts.Root = t.TempDir()
	}

	backend, err := NewBleveBackend(opts, metrics)
	require.NoError(t, err)
	require.NotNil(t, backend)
	t.Cleanup(backend.Stop)
	return backend, reg
}

type setupOption func(options *BleveOptions)

func withIndexCacheTTL(ttl time.Duration) setupOption {
	return func(options *BleveOptions) {
		options.IndexCacheTTL = ttl
	}
}

func withFileThreshold(threshold int) setupOption {
	return func(options *BleveOptions) {
		options.FileThreshold = int64(threshold)
	}
}

func withRootDir(root string) setupOption {
	return func(options *BleveOptions) {
		options.Root = root
	}
}

func withOwnsIndexFn(fn func(key resource.NamespacedResource) (bool, error)) setupOption {
	return func(options *BleveOptions) {
		options.OwnsIndex = fn
	}
}

func withIndexMinUpdateInterval(d time.Duration) setupOption {
	return func(options *BleveOptions) {
		options.IndexMinUpdateInterval = d
	}
}

func TestBuildIndexExpiration(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	type testCase struct {
		inMemory         bool
		owned            bool
		ownedCheckError  error
		expectedEviction bool
	}

	cacheTTL := time.Millisecond

	for name, tc := range map[string]testCase{
		"memory index should expire, if owned": {
			inMemory:         true,
			owned:            true,
			expectedEviction: true,
		},
		"memory index should expire, if not owned": {
			inMemory:         true,
			owned:            false,
			expectedEviction: true,
		},
		"memory index should expire, if ownership check fails": {
			inMemory:         true,
			ownedCheckError:  errors.New("error"),
			expectedEviction: true,
		},
		"file index should NOT expire, if owned": {
			inMemory:         false,
			owned:            true,
			expectedEviction: false,
		},
		"file index should expire, if not owned": {
			inMemory:         false,
			owned:            false,
			expectedEviction: true,
		},
		"file index should NOT expire, if ownership check fails": {
			inMemory:         false,
			ownedCheckError:  errors.New("error"),
			expectedEviction: false,
		},
	} {
		t.Run(name, func(t *testing.T) {
			backend, reg := setupBleveBackend(t, withIndexCacheTTL(cacheTTL), withOwnsIndexFn(func(key resource.NamespacedResource) (bool, error) {
				return tc.owned, tc.ownedCheckError
			}))

			size := int64(1)
			if !tc.inMemory {
				size = 100 // above defaultFileTreshold
			}
			builtIndex, err := backend.BuildIndex(context.Background(), ns, size, nil, "test", indexTestDocs(ns, 1, 100), nil, false, time.Time{})
			require.NoError(t, err)

			// Evict indexes.
			backend.runEvictExpiredOrUnownedIndexes(time.Now().Add(5 * time.Minute))

			if tc.expectedEviction {
				idx := backend.GetIndex(ns)
				require.Nil(t, idx)

				_, err = builtIndex.DocCount(context.Background(), "", nil)
				require.ErrorIs(t, err, bleve.ErrorIndexClosed)

				// Verify that there are no open indexes.
				checkOpenIndexes(t, reg, 0, 0)
			} else {
				idx := backend.GetIndex(ns)
				require.NotNil(t, idx)

				cnt, err := builtIndex.DocCount(context.Background(), "", nil)
				require.NoError(t, err)
				require.Equal(t, int64(1), cnt)

				// Verify that index is still open
				if tc.inMemory {
					checkOpenIndexes(t, reg, 1, 0)
				} else {
					checkOpenIndexes(t, reg, 0, 1)
				}
			}
		})
	}
}

func TestCloseAllIndexes(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}
	ns2 := resource.NamespacedResource{
		Namespace: "test2",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()
	backend1, reg := setupBleveBackend(t, withRootDir(tmpDir))
	_, err := backend1.BuildIndex(context.Background(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), nil, false, time.Time{})
	require.NoError(t, err)
	_, err = backend1.BuildIndex(context.Background(), ns2, 1 /* memory based */, nil, "test", indexTestDocs(ns, 10, 100), nil, false, time.Time{})
	require.NoError(t, err)

	// Verify two open indexes.
	checkOpenIndexes(t, reg, 1, 1)
	backend1.closeAllIndexes()

	// Verify that there are no open indexes after closeAllIndexes call.
	checkOpenIndexes(t, reg, 0, 0)
}

func TestBuildIndex(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	for _, rebuild := range []bool{false, true} {
		testName := fmt.Sprintf("rebuild=%t", rebuild)

		t.Run(testName, func(t *testing.T) {
			tmpDir := t.TempDir()

			const (
				firstIndexDocsCount  = 10
				secondIndexDocsCount = 1000
			)

			var lastImportTime time.Time
			if rebuild {
				// Pass time.Now() to force rebuild
				lastImportTime = time.Now()
			}
			// else: zero time means no rebuild based on import time

			{
				backend, _ := setupBleveBackend(t, withFileThreshold(5), withRootDir(tmpDir))
				_, err := backend.BuildIndex(context.Background(), ns, firstIndexDocsCount, nil, "test", indexTestDocs(ns, firstIndexDocsCount, 100), nil, false, lastImportTime)
				require.NoError(t, err)
				backend.Stop()
			}

			// Make sure we pass at least 1 nanosecond (alwaysRebuildDueToAge) to ensure that the index needs to be rebuild.
			time.Sleep(1 * time.Millisecond)

			newBackend, _ := setupBleveBackend(t, withFileThreshold(5), withRootDir(tmpDir))
			idx, err := newBackend.BuildIndex(context.Background(), ns, secondIndexDocsCount, nil, "test", indexTestDocs(ns, secondIndexDocsCount, 100), nil, false, lastImportTime)
			require.NoError(t, err)

			cnt, err := idx.DocCount(context.Background(), "", nil)
			require.NoError(t, err)
			if rebuild {
				require.Equal(t, int64(secondIndexDocsCount), cnt, "Index has been not rebuilt")
			} else {
				require.Equal(t, int64(firstIndexDocsCount), cnt, "Index has not been reused")
			}
		})
	}
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
			backend, reg := setupBleveBackend(t, withIndexCacheTTL(time.Nanosecond))

			firstSize := 100
			if testCase.firstInMemory {
				firstSize = 1
			}
			firstIndex, err := backend.BuildIndex(context.Background(), ns, int64(firstSize), nil, "test", indexTestDocs(ns, firstSize, 100), nil, false, time.Time{})
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
			secondIndex, err := backend.BuildIndex(context.Background(), ns, int64(secondSize), nil, "test", indexTestDocs(ns, secondSize, 100), nil, false, time.Time{})
			require.NoError(t, err)

			if testCase.secondInMemory {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 0)
			} else {
				verifyDirEntriesCount(t, backend.getResourceDir(ns), 1)
			}

			// Verify that first and second index are different, and first one is now closed.
			require.NotEqual(t, firstIndex, secondIndex)

			_, err = firstIndex.DocCount(context.Background(), "", nil)
			require.ErrorIs(t, err, bleve.ErrorIndexClosed)

			cnt, err := secondIndex.DocCount(context.Background(), "", nil)
			require.NoError(t, err)
			require.Equal(t, int64(secondSize), cnt)

			checkOpenIndexes(t, reg, openInMemoryIndexes, 1-openInMemoryIndexes)
		})
	}
}

func checkOpenIndexes(t *testing.T, reg prometheus.Gatherer, memory, file int) {
	require.NoError(t, testutil.GatherAndCompare(reg, bytes.NewBufferString(fmt.Sprintf(`
		# HELP index_server_open_indexes Number of open indexes per storage type. An open index corresponds to single resource group.
		# TYPE index_server_open_indexes gauge
		index_server_open_indexes{index_storage="memory"} %d
		index_server_open_indexes{index_storage="file"} %d
	`, memory, file)), "index_server_open_indexes"))
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

func updateTestDocsReturningMillisTimestamp(ns resource.NamespacedResource, docs int) (resource.UpdateFn, *atomic.Int64) {
	cnt := 0
	updateCalls := atomic.NewInt64(0)

	return func(context context.Context, index resource.ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error) {
		now := time.Now()
		updateCalls.Inc()

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
		return now.UnixMilli(), docs, err
	}, updateCalls
}

func TestCleanOldIndexes(t *testing.T) {
	dir := t.TempDir()

	b, _ := setupBleveBackend(t, withRootDir(dir))

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
	backend, _ := setupBleveBackend(t)

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
	_, err := backend.BuildIndex(context.Background(), ns, size, nil, "test", func(index resource.ResourceIndex) (int64, error) {
		return 0, fmt.Errorf("fail")
	}, nil, false, time.Time{})
	require.Error(t, err)

	// Even though previous build of the index failed, new building of the index should work.
	_, err = backend.BuildIndex(context.Background(), ns, size, nil, "test", indexTestDocs(ns, int(size), 100), nil, false, time.Time{})
	require.NoError(t, err)
}

func TestIndexUpdate(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t)
	idx, err := be.BuildIndex(t.Context(), ns, defaultFileThreshold*2 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, time.Time{})
	require.NoError(t, err)

	resp := searchTitle(t, idx, "gen", 10, ns)
	require.Equal(t, int64(0), resp.TotalHits)

	// Update index.
	_, err = idx.UpdateIndex(context.Background())
	require.NoError(t, err)

	// Verify that index was updated -- number of docs didn't change, but we can search "gen_1" documents now.
	require.Equal(t, 10, docCount(t, idx))
	require.Equal(t, int64(5), searchTitle(t, idx, "gen_1", 10, ns).TotalHits)

	// Update index again.
	_, err = idx.UpdateIndex(context.Background())
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

	be, _ := setupBleveBackend(t)

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

	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, time.Time{})
	require.NoError(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	_, err = idx.UpdateIndex(ctx)
	require.NoError(t, err)

	_, err = be.BuildIndex(t.Context(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, time.Time{})
	require.NoError(t, err)

	_, err = idx.UpdateIndex(ctx)
	require.Contains(t, err.Error(), bleve.ErrorIndexClosed.Error())
}

func TestConcurrentIndexUpdateSearchAndRebuild(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t)

	_, err := be.BuildIndex(t.Context(), ns, 10, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, time.Time{})
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

				idx := be.GetIndex(ns)
				_, err = idx.UpdateIndex(ctx)
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
				}, nil, nil)
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
			_, err := be.BuildIndex(t.Context(), ns, 10, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, time.Time{})
			require.NoError(t, err)
			rebuilds.Inc()
		}
	}()

	time.Sleep(5 * time.Second)
	cancel()
	wg.Wait()

	t.Log("Updates:", updates.Load(), "searches:", searches.Load(), "rebuilds:", rebuilds.Load())
}

// Verify concurrent updates and searches work as expected.
func TestConcurrentIndexUpdateAndSearch(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t)

	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updateTestDocs(ns, 5), false, time.Time{})
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
				rv, err := idx.UpdateIndex(t.Context())
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

func TestConcurrentIndexUpdateAndSearchWithIndexMinUpdateInterval(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	const minInterval = 100 * time.Millisecond
	be, _ := setupBleveBackend(t, withIndexMinUpdateInterval(minInterval))

	updateFn, updateCalls := updateTestDocsReturningMillisTimestamp(ns, 5)
	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updateFn, false, time.Time{})
	require.NoError(t, err)

	wg := sync.WaitGroup{}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	attemptedUpdates := atomic.NewInt64(0)

	// Verify that each returned RV (unix timestamp in millis) is either the same as before, or at least minInterval later.
	const searchConcurrency = 10
	for i := 0; i < searchConcurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()

			var collectedRVs []int64
			for ctx.Err() == nil {
				attemptedUpdates.Inc()

				// We use t.Context() here to avoid getting errors from context cancellation.
				rv, err := idx.UpdateIndex(t.Context())
				require.NoError(t, err)

				if len(collectedRVs) == 0 || collectedRVs[len(collectedRVs)-1] != rv {
					collectedRVs = append(collectedRVs, rv)
				}

				require.Equal(t, int64(10), searchTitle(t, idx, "Document", 10, ns).TotalHits)
			}

			t.Log(collectedRVs)
			for i := 1; i < len(collectedRVs); i++ {
				// We allow next RV to be 0.9*minInterval later, to account for possible clock skew between time measurements.
				// (We get measurements from update function, but check is done on times inside updater)
				require.GreaterOrEqual(t, collectedRVs[i], collectedRVs[i-1]+(9*int64(minInterval/time.Millisecond)/10))
			}
		}()
	}

	// Run updates and searches for this time.
	testTime := 1 * time.Second

	time.Sleep(testTime)
	cancel()
	wg.Wait()

	expectedMaxCalls := int64(testTime / minInterval)
	require.LessOrEqual(t, updateCalls.Load(), expectedMaxCalls+1)
	require.Greater(t, attemptedUpdates.Load(), updateCalls.Load())

	t.Log("Attempted updates:", attemptedUpdates.Load(), "update calls:", updateCalls.Load())
}

func TestIndexUpdateWithErrors(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t)

	updateErr := fmt.Errorf("failed to update index")
	updaterFn := func(context context.Context, index resource.ResourceIndex, sinceRV int64) (newRV int64, updatedDocs int, _ error) {
		time.Sleep(100 * time.Millisecond)
		return 0, 0, updateErr
	}
	idx, err := be.BuildIndex(t.Context(), ns, 10 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), updaterFn, false, time.Time{})
	require.NoError(t, err)

	t.Run("update fail", func(t *testing.T) {
		_, err = idx.UpdateIndex(t.Context())
		require.ErrorIs(t, err, updateErr)
	})

	t.Run("update timeout", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
		defer cancel()

		_, err = idx.UpdateIndex(ctx)
		require.ErrorIs(t, err, context.DeadlineExceeded)
	})

	t.Run("context canceled", func(t *testing.T) {
		// Canceled context
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		_, err = idx.UpdateIndex(ctx)
		require.ErrorIs(t, err, context.Canceled)
	})
}

func TestIndexBuildInfo(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	be, _ := setupBleveBackend(t, withFileThreshold(100))
	index, err := be.BuildIndex(t.Context(), ns, 10, nil, "test", indexTestDocs(ns, 10, 100), nil, false, time.Time{})
	require.NoError(t, err)

	buildInfo, err := getBuildInfo(index.(*bleveIndex).index)
	require.NoError(t, err)
	require.NotNil(t, buildInfo)
	require.Equal(t, buildVersion, buildInfo.BuildVersion)
	require.InDelta(t, float64(time.Now().Unix()), buildInfo.BuildTime, 30) // allow 30 seconds of drift
}

func TestInvalidBuildVersion(t *testing.T) {
	opts := BleveOptions{
		Root:         t.TempDir(),
		BuildVersion: "invalid",
	}
	_, err := NewBleveBackend(opts, nil)
	require.ErrorContains(t, err, "cannot parse build version")
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
	}, nil, nil)
	require.NoError(t, err)
	return resp
}

func docCount(t *testing.T, idx resource.ResourceIndex) int {
	cnt, err := idx.DocCount(context.Background(), "", nil)
	require.NoError(t, err)
	return int(cnt)
}

func TestBuildIndexReturnsErrorWhenIndexLocked(t *testing.T) {
	ns := resource.NamespacedResource{
		Namespace: "test",
		Group:     "group",
		Resource:  "resource",
	}

	tmpDir := t.TempDir()

	// First, create a file-based index with one backend and keep it open
	backend1, reg1 := setupBleveBackend(t, withRootDir(tmpDir))
	index1, err := backend1.BuildIndex(context.Background(), ns, 100 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), nil, false, time.Time{})
	require.NoError(t, err)
	require.NotNil(t, index1)

	// Verify first index is file-based
	bleveIdx1, ok := index1.(*bleveIndex)
	require.True(t, ok)
	require.Equal(t, indexStorageFile, bleveIdx1.indexStorage)
	checkOpenIndexes(t, reg1, 0, 1)

	// Now create a second backend using the same directory
	// This simulates another instance trying to open the same index
	backend2, _ := setupBleveBackend(t, withRootDir(tmpDir))

	// BuildIndex should detect the file is locked and return an error after timeout
	now := time.Now()
	timeout, err := time.ParseDuration(boltTimeout)
	require.NoError(t, err)
	index2, err := backend2.BuildIndex(context.Background(), ns, 100 /* file based */, nil, "test", indexTestDocs(ns, 10, 100), nil, false, time.Time{})
	require.Error(t, err)
	require.ErrorIs(t, err, bolterrors.ErrTimeout)
	require.Nil(t, index2)
	require.GreaterOrEqual(t, time.Since(now).Milliseconds(), timeout.Milliseconds()-500, "BuildIndex should have waited for approximately boltTimeout duration")

	// Clean up: close first backend to release the file lock
	backend1.Stop()
}
