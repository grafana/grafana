package sql

import (
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestBlobGCConfig(t *testing.T) {
	cfg := setting.NewCfg()
	require.False(t, NewGarbageCollectionConfig(cfg).BlobEnabled)
	cfg.BlobGarbageCollectionEnabled = true
	cfg.BlobGarbageCollectionDryRun = true
	gc := NewGarbageCollectionConfig(cfg)
	require.True(t, gc.BlobEnabled)
	require.True(t, gc.BlobDryRun)
}

func TestIntegrationExternalBlobGarbageCollection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)
	storage, _ := newTestBackend(t, GarbageCollectionConfig{Interval: time.Minute, MaxAge: time.Hour, BatchSize: 100})
	b := storage.(*backend)
	b.blobURL = "file://" + filepath.ToSlash(t.TempDir())
	bucket, err := resource.OpenBlobBucket(t.Context(), b.blobURL)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, bucket.Close()) })
	blobs, err := resource.NewCDKBlobSupport(t.Context(), resource.CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	key := &resourcepb.ResourceKey{Group: "group", Resource: "resource", Namespace: "namespace", Name: "snap"}
	response, err := blobs.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{Resource: key, ContentType: "image/png", Value: []byte("image")})
	require.NoError(t, err)
	// The first pass only observes the orphan; the second pass collects it.
	b.collectBlobs(t.Context())
	require.NotNil(t, b.blobGC)
	count, err := b.blobGC.Collect(t.Context(), time.Now().Add(2*time.Hour), time.Hour, false, b.blobReferenced)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = blobs.GetResourceBlob(t.Context(), key, &utils.BlobInfo{UID: response.Uid, MimeType: "image/png"}, true)
	require.Error(t, err)
}

func TestIntegrationBlobGarbageCollection(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	t.Cleanup(db.CleanupTestDB)
	const batchSize = 2
	const blobCount = 5
	storage, database := newTestBackend(t, GarbageCollectionConfig{Interval: time.Minute, MaxAge: time.Hour, BatchSize: batchSize})
	b := storage.(*backend)
	ctx := t.Context()
	key := &resourcepb.ResourceKey{Group: "group", Resource: "resource", Namespace: "namespace", Name: "snap"}
	response, err := b.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, ContentType: "application/json", Value: []byte(`{}`)})
	require.NoError(t, err)
	require.Nil(t, response.Error)
	require.Equal(t, byte('7'), response.Uid[14], "uid %q must be a UUIDv7", response.Uid)
	for i := 1; i < blobCount; i++ {
		response, err := b.PutResourceBlob(ctx, &resourcepb.PutBlobRequest{Resource: key, ContentType: "application/json", Value: []byte(`{}`)})
		require.NoError(t, err)
		require.Nil(t, response.Error)
	}
	_, err = test.WriteEvent(ctx, storage, key.Name, resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	dialect, err := kv.DialectFromDriver(database.DriverName())
	require.NoError(t, err)
	_, err = database.SqlDB().ExecContext(ctx, fmt.Sprintf("UPDATE %s SET %s = %s", dialect.QuoteIdent("resource_history"), dialect.QuoteIdent("value"), dialect.Placeholder(1)), []byte(fmt.Sprintf(`{"blobs":{"dashboard":{"uid":%q}}}`, response.Uid)))
	require.NoError(t, err)
	store, err := kv.NewSQLKV(database.SqlDB(), database.DriverName())
	require.NoError(t, err)
	gc := resource.NewBlobGarbageCollector(store, batchSize, 0)
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
	require.Equal(t, blobCount, count)
	count, err = gc.Collect(ctx, now.Add(2*time.Hour), time.Hour, false, b.blobReferenced)
	require.NoError(t, err)
	require.Equal(t, blobCount, count)
	keys := 0
	for _, err := range store.Keys(ctx, kv.BlobDataSection, kv.ListOptions{}) {
		require.NoError(t, err)
		keys++
	}
	require.Zero(t, keys)
}
