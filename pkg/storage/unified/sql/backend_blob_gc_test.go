package sql

import (
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationBlobGarbageCollection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)
	storage, database := newTestBackend(t, GarbageCollectionConfig{Interval: time.Minute, MaxAge: time.Hour, BatchSize: 100})
	b := storage.(*backend)
	ctx := t.Context()
	key := &resourcepb.ResourceKey{Group: "group", Resource: "resource", Namespace: "namespace", Name: "snap"}
	response, err := b.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, ContentType: "application/json", Value: []byte(`{}`)})
	require.NoError(t, err)
	require.Nil(t, response.Error)
	_, err = test.WriteEvent(ctx, storage, key.Name, resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	dialect, err := kv.DialectFromDriver(database.DriverName())
	require.NoError(t, err)
	_, err = database.SqlDB().ExecContext(ctx, fmt.Sprintf("UPDATE %s SET %s = %s", dialect.QuoteIdent("resource_history"), dialect.QuoteIdent("value"), dialect.Placeholder(1)), []byte(fmt.Sprintf(`{"blobs":{"dashboard":{"uid":%q}}}`, response.Uid)))
	require.NoError(t, err)
	store, err := kv.NewSQLKV(database.SqlDB(), database.DriverName())
	require.NoError(t, err)
	gc := resource.NewBlobGarbageCollector(store, 100, 0)
	now := time.Now()
	count, err := gc.Collect(ctx, now, time.Hour, false, b.blobReferenced)
	require.NoError(t, err)
	require.Zero(t, count)
	_, err = database.SqlDB().ExecContext(ctx, "DELETE FROM "+dialect.QuoteIdent("resource_history"))
	require.NoError(t, err)
	count, err = gc.Collect(ctx, now, time.Hour, false, b.blobReferenced)
	require.NoError(t, err)
	require.Zero(t, count)
	count, err = gc.Collect(ctx, now.Add(2*time.Hour), time.Hour, true, b.blobReferenced)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	count, err = gc.Collect(ctx, now.Add(2*time.Hour), time.Hour, false, b.blobReferenced)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	keys := 0
	for _, err := range store.Keys(ctx, kv.BlobDataSection, kv.ListOptions{}) {
		require.NoError(t, err)
		keys++
	}
	require.Zero(t, keys)
}
