package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Test names for the search backend test suite
const (
	TestBuildIndex    = "build index"
	TestTotalDocs     = "total docs"
	TestResourceIndex = "resource index"
)

// NewSearchBackendFunc is a function that creates a new SearchBackend instance
type NewSearchBackendFunc func(ctx context.Context) resource.SearchBackend

// RunSearchBackendTest runs the search backend test suite
func RunSearchBackendTest(t *testing.T, newBackend NewSearchBackendFunc, opts *TestOptions) {
	if opts == nil {
		opts = &TestOptions{}
	}

	if opts.NSPrefix == "" {
		opts.NSPrefix = "test-" + time.Now().Format("20060102150405")
	}

	t.Logf("Running tests with namespace prefix: %s", opts.NSPrefix)

	cases := []struct {
		name string
		fn   func(*testing.T, resource.SearchBackend, string)
	}{
		{TestBuildIndex, runTestSearchBackendBuildIndex},
		{TestTotalDocs, runTestSearchBackendTotalDocs},
		{TestResourceIndex, runTestResourceIndex},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tc.fn(t, newBackend(context.Background()), opts.NSPrefix)
		})
	}
}

func runTestSearchBackendBuildIndex(t *testing.T, backend resource.SearchBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	ns := resource.NamespacedResource{
		Namespace: nsPrefix + "-ns1",
		Group:     "group",
		Resource:  "resource",
	}

	// Get the index should return nil if the index does not exist
	index, err := backend.GetIndex(ctx, ns)
	require.NoError(t, err)
	require.Nil(t, index)

	// Build the index
	index, err = backend.BuildIndex(ctx, ns, 0, 0, nil, "test", func(index resource.ResourceIndex) (int64, error) {
		// Write a test document
		err := index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resourcepb.ResourceKey{
							Namespace: ns.Namespace,
							Group:     ns.Group,
							Resource:  ns.Resource,
							Name:      "doc1",
						},
						Title: "Document 1",
					},
				},
			},
		})
		if err != nil {
			return 0, err
		}
		return 1, nil
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, index)

	// Get the index should now return the index
	index, err = backend.GetIndex(ctx, ns)
	require.NoError(t, err)
	require.NotNil(t, index)
}

func runTestSearchBackendTotalDocs(t *testing.T, backend resource.SearchBackend, nsPrefix string) {
	// Get total document count
	count := backend.TotalDocs()
	require.GreaterOrEqual(t, count, int64(0))
}

func runTestResourceIndex(t *testing.T, backend resource.SearchBackend, nsPrefix string) {
	ctx := testutil.NewTestContext(t, time.Now().Add(50*time.Second))
	ns := resource.NamespacedResource{
		Namespace: nsPrefix + "-ns1",
		Group:     "group",
		Resource:  "resource",
	}

	// Build initial index with some test documents
	index, err := backend.BuildIndex(ctx, ns, 3, 0, nil, "test", func(index resource.ResourceIndex) (int64, error) {
		err := index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resourcepb.ResourceKey{
							Namespace: ns.Namespace,
							Group:     ns.Group,
							Resource:  ns.Resource,
							Name:      "doc1",
						},
						Title: "Document 1",
						Tags:  []string{"tag1", "tag2"},
						Fields: map[string]interface{}{
							"field1": 1,
							"field2": "value1",
						},
					},
				},
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resourcepb.ResourceKey{
							Namespace: ns.Namespace,
							Group:     ns.Group,
							Resource:  ns.Resource,
							Name:      "doc2",
						},
						Title: "Document 2",
						Tags:  []string{"tag2", "tag3"},
						Fields: map[string]interface{}{
							"field1": 2,
							"field2": "value2",
						},
					},
				},
			},
		})
		require.NoError(t, err)
		return int64(2), nil
	}, nil)
	require.NoError(t, err)
	require.NotNil(t, index)

	t.Run("Search", func(t *testing.T) {
		resp, err := index.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: ns.Namespace,
					Group:     ns.Group,
					Resource:  ns.Resource,
				},
			},
			Fields: []string{"title", "folder", "tags"},
			Query:  "tag3",
			Limit:  10,
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(1), resp.TotalHits) // Only doc3 should have tag3 now

		// Search for Document
		resp, err = index.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: ns.Namespace,
					Group:     ns.Group,
					Resource:  ns.Resource,
				},
			},
			Query:  "Document",
			Fields: []string{"title", "folder", "tags"},
			Limit:  10,
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(2), resp.TotalHits) // Both doc1 and doc2 should have doc now
	})

	t.Run("Add a new document", func(t *testing.T) {
		// Add a new document
		err := index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resourcepb.ResourceKey{
							Namespace: ns.Namespace,
							Group:     ns.Group,
							Resource:  ns.Resource,
							Name:      "doc3",
						},
						Title: "Document 3",
						Tags:  []string{"tag3", "tag4"},
						Fields: map[string]interface{}{
							"field1": 3,
							"field2": "value3",
						},
					},
				},
			},
		})
		require.NoError(t, err)
		// Search for Document
		resp, err := index.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: ns.Namespace,
					Group:     ns.Group,
					Resource:  ns.Resource,
				},
			},
			Query:  "Document",
			Fields: []string{"title", "folder", "tags"},
			Limit:  10,
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(3), resp.TotalHits) // Both doc1, doc2, and doc3 should have doc now
	})

	t.Run("Search by LibraryPanel reference", func(t *testing.T) {
		// Build index with dashboards that have LibraryPanel references
		index, err := backend.BuildIndex(ctx, ns, 3, 0, nil, "test", func(index resource.ResourceIndex) (int64, error) {
			err := index.BulkIndex(&resource.BulkIndexRequest{
				Items: []*resource.BulkIndexItem{
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							Key: &resourcepb.ResourceKey{
								Namespace: ns.Namespace,
								Group:     ns.Group,
								Resource:  ns.Resource,
								Name:      "dash1",
							},
							Title: "Dashboard with Library Panel 1",
							References: resource.ResourceReferences{
								{
									Relation: "depends-on",
									Group:    "dashboards.grafana.app",
									Kind:     "LibraryPanel",
									Name:     "lib-panel-1",
								},
							},
						},
					},
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							Key: &resourcepb.ResourceKey{
								Namespace: ns.Namespace,
								Group:     ns.Group,
								Resource:  ns.Resource,
								Name:      "dash2",
							},
							Title: "Dashboard with Library Panel 2",
							References: resource.ResourceReferences{
								{
									Relation: "depends-on",
									Group:    "dashboards.grafana.app",
									Kind:     "LibraryPanel",
									Name:     "lib-panel-2",
								},
							},
						},
					},
					{
						Action: resource.ActionIndex,
						Doc: &resource.IndexableDocument{
							Key: &resourcepb.ResourceKey{
								Namespace: ns.Namespace,
								Group:     ns.Group,
								Resource:  ns.Resource,
								Name:      "dash3",
							},
							Title: "Dashboard without Library Panel",
						},
					},
				},
			})
			require.NoError(t, err)
			return int64(3), nil
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, index)

		// Search for dashboards with specific LibraryPanel reference
		resp, err := index.Search(ctx, nil, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: ns.Namespace,
					Group:     ns.Group,
					Resource:  ns.Resource,
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:      "reference.LibraryPanel",
						Operator: "=",
						Values:   []string{"lib-panel-1"},
					},
				},
			},
			Query:  "",
			Fields: []string{"title"},
			Limit:  10,
		}, nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(1), resp.TotalHits) // Only dash1 should have lib-panel-1

		// Verify the result
		require.Len(t, resp.Results.Rows, 1)
		row := resp.Results.Rows[0]
		require.Equal(t, "dash1", row.Key.Name)
		require.Equal(t, "Dashboard with Library Panel 1", string(row.Cells[0])) // title field
	})
}
