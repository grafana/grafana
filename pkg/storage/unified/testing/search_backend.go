package test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
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
	if testing.Short() {
		t.Skip("skipping integration test")
	}

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
	index, err = backend.BuildIndex(ctx, ns, 0, 0, nil, func(index resource.ResourceIndex) (int64, error) {
		// Write a test document
		err := index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resource.ResourceKey{
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
	})
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
	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	ns := resource.NamespacedResource{
		Namespace: nsPrefix + "-ns1",
		Group:     "group",
		Resource:  "resource",
	}

	// Build initial index with some test documents
	index, err := backend.BuildIndex(ctx, ns, 3, 0, nil, func(index resource.ResourceIndex) (int64, error) {
		err := index.BulkIndex(&resource.BulkIndexRequest{
			Items: []*resource.BulkIndexItem{
				{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						Key: &resource.ResourceKey{
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
						Key: &resource.ResourceKey{
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
	})
	require.NoError(t, err)
	require.NotNil(t, index)

	t.Run("Search", func(t *testing.T) {
		req := &resource.ResourceSearchRequest{
			Options: &resource.ListOptions{
				Key: &resource.ResourceKey{
					Namespace: ns.Namespace,
					Group:     ns.Group,
					Resource:  ns.Resource,
				},
			},
			Fields: []string{"title", "folder", "tags"},
			Query:  "tag3",
			Limit:  10,
		}
		resp, err := index.Search(ctx, nil, req, nil)
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, int64(1), resp.TotalHits) // Only doc3 should have tag3 now
	})
}
