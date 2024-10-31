package test

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
	"golang.org/x/net/context"
)

// addResource is a helper to create a resource in unified storage
func addResource(t *testing.T, ctx context.Context, backend sql.Backend, resourceName string, data string) {
	ir, err := resource.NewIndexedResource([]byte(data))
	require.NoError(t, err)
	_, err = backend.WriteEvent(ctx, resource.WriteEvent{
		Type:  resource.WatchEvent_ADDED,
		Value: []byte(data),
		Key: &resource.ResourceKey{
			Namespace: ir.Namespace,
			Group:     ir.Group,
			Resource:  resourceName,
			Name:      ir.Name,
		},
	})
	require.NoError(t, err)
}

func TestIntegrationIndexerSearch(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	ctx := testutil.NewTestContext(t, time.Now().Add(5*time.Second))
	cfg := setting.NewCfg()
	cfg.IndexWorkers = 1
	cfg.IndexMaxBatchSize = 100
	cfg.IndexListLimit = 100
	backend, server := newServer(t, cfg)

	playlist1 := `{
  		"kind": "Playlist",
  		"apiVersion": "playlist.grafana.app/v0alpha1",
  		"metadata": {
    		"name": "playlist dogs",
    		"namespace": "tenant1",
    		"uid": "1fe028dc-81bb-4268-a3ff-20899ff0a16f",
    		"resourceVersion": "1",
    		"creationTimestamp": "2024-01-01T12:00:00Z"
  		},
  		"spec": {
			"interval": "5m",
			"title": "dogs"
  		}
	}`
	playlist2 := `{
  		"kind": "Playlist",
  		"apiVersion": "playlist.grafana.app/v0alpha1",
  		"metadata": {
    		"name": "playlist cats",
    		"namespace": "tenant1",
    		"uid": "1fe028dc-81bb-4268-a3ff-20899ff0a16f123",
    		"resourceVersion": "2",
    		"creationTimestamp": "2024-01-02T12:00:00Z"
  		},
  		"spec": {
			"interval": "5m",
			"title": "cats"
  		}
	}`

	// add playlist1 and playlist2 to unified storage
	addResource(t, ctx, backend, "playlists", playlist1)
	addResource(t, ctx, backend, "playlists", playlist2)

	// initialze and build the search index
	indexer, ok := server.(resource.ResourceIndexer)
	if !ok {
		t.Fatal("server does not implement ResourceIndexer")
	}
	_, err := indexer.Index(ctx)
	require.NoError(t, err)

	// run search tests against the index
	t.Run("can search for all resources", func(t *testing.T) {
		res, err := server.Search(ctx, &resource.SearchRequest{
			Tenant: "tenant1",
			Query:  "*",
			Limit:  10,
			Offset: 0,
		})
		require.NoError(t, err)
		require.Len(t, res.Items, 2)
	})

	t.Run("can search for resources by title", func(t *testing.T) {
		res, err := server.Search(ctx, &resource.SearchRequest{
			Tenant: "tenant1",
			Query:  "Spec.title:dogs",
			Limit:  10,
			Offset: 0,
		})
		require.NoError(t, err)
		require.Len(t, res.Items, 1)
	})

	t.Run("can filter resources by created time", func(t *testing.T) {
		res, err := server.Search(ctx, &resource.SearchRequest{
			Tenant: "tenant1",
			Query:  "CreatedAt:>=\"2024-01-02\"",
			Limit:  10,
			Offset: 0,
		})
		require.NoError(t, err)

		require.Len(t, res.Items, 1)
		ir := resource.IndexedResource{}
		err = json.Unmarshal(res.Items[0].Value, &ir)
		require.NoError(t, err)
		require.Equal(t, "playlist cats", ir.Name)
	})
}
