package sql

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// sliceBulkRequestIterator feeds a fixed set of requests to ProcessBulk.
type sliceBulkRequestIterator struct {
	idx   int
	items []*resourcepb.BulkRequest
}

func newSliceBulkRequestIterator(items ...*resourcepb.BulkRequest) *sliceBulkRequestIterator {
	return &sliceBulkRequestIterator{idx: -1, items: items}
}

func (i *sliceBulkRequestIterator) Next() bool {
	i.idx++
	return i.idx < len(i.items)
}

func (i *sliceBulkRequestIterator) Request() *resourcepb.BulkRequest { return i.items[i.idx] }

func (i *sliceBulkRequestIterator) RollbackRequested() bool { return false }

// TestIntegrationBulkProcessAnalyzesResourceHistory exercises the bulk migration path,
// including the ANALYZE that runs before the resource backfill. The row threshold is
// lowered so the path is hit with a handful of rows instead of the production default.
func TestIntegrationBulkProcessAnalyzesResourceHistory(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)

	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	storageBackend, _ := newTestBackend(t, GarbageCollectionConfig{})
	b := storageBackend.(*backend)
	b.analyzeBulkRowThreshold = 1 // trigger ANALYZE with a small load

	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     "shorturl.grafana.app",
		Resource:  "shorturls",
	}
	iter := newSliceBulkRequestIterator(
		newSQLBulkRequest("item-1", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-1","namespace":"default"},"spec":{"path":"d/a"}}`)),
		newSQLBulkRequest("item-2", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-2","namespace":"default"},"spec":{"path":"d/b"}}`)),
		newSQLBulkRequest("item-3", resourcepb.BulkRequest_ADDED, []byte(`{"apiVersion":"shorturl.grafana.app/v1beta1","kind":"ShortURL","metadata":{"name":"item-3","namespace":"default"},"spec":{"path":"d/c"}}`)),
	)

	resp := b.ProcessBulk(ctx, resource.BulkSettings{
		Collection: []*resourcepb.ResourceKey{key},
	}, iter)
	require.Nil(t, resp.Error)
	require.Equal(t, int64(3), resp.Processed)

	// The backfill must have populated the resource table from history.
	server, err := resource.NewResourceServer(resource.ResourceServerOptions{Backend: storageBackend})
	require.NoError(t, err)
	listResp, err := server.List(ctx, &resourcepb.ListRequest{
		Source:  resourcepb.ListRequest_STORE,
		Options: &resourcepb.ListOptions{Key: key},
	})
	require.NoError(t, err)
	require.Nil(t, listResp.Error)
	require.Len(t, listResp.Items, 3)

	// On Postgres the ANALYZE must have refreshed statistics: a freshly created table
	// reports reltuples=0/-1, so a positive estimate proves the ANALYZE ran.
	if b.dialect.DialectName() == "postgres" {
		var reltuples float64
		row := b.db.QueryRowContext(ctx, `SELECT reltuples FROM pg_class WHERE relname = 'resource_history'`)
		require.NoError(t, row.Scan(&reltuples))
		require.Greater(t, reltuples, float64(0))
	}
}
