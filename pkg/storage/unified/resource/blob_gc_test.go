package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestResourceReferencesBlob(t *testing.T) {
	for _, tc := range []struct {
		name, value   string
		live, failure bool
	}{
		{name: "snapshot", value: `{"blobs":{"dashboard":{"uid":"blob"}}}`, live: true},
		{name: "multiple references", value: `{"blobs":{"other":{"uid":"other"},"dashboard":{"uid":"blob"}}}`, live: true},
		{name: "annotation", value: `{"metadata":{"annotations":{"grafana.app/blob":"blob; size=12"}}}`, live: true},
		{name: "different uid", value: `{"blobs":{"dashboard":{"uid":"other"}}}`},
		{name: "inline snapshot", value: `{"spec":{"dashboard":{}}}`},
		{name: "malformed", value: `{`, failure: true},
		{name: "malformed references", value: `{"blobs":{"dashboard":"blob"}}`, failure: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			live, err := ResourceReferencesBlob([]byte(tc.value), "blob")
			require.Equal(t, tc.failure, err != nil)
			require.Equal(t, tc.live, live)
		})
	}
}

func TestBlobGarbageCollector(t *testing.T) {
	for _, scenario := range []string{"orphan", "referenced", "dry run", "read error", "reference appears", "restart"} {
		t.Run(scenario, func(t *testing.T) {
			store := setupSqlKV(t)
			key := kv.BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap", UID: "blob"}
			writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
			require.NoError(t, err)
			_, err = writer.Write(append(kv.EncodeBlobValueHeader("text/plain"), []byte("payload")...))
			require.NoError(t, err)
			require.NoError(t, writer.Close())
			gc := NewBlobGarbageCollector(store, 100, 0)
			now := time.Now()
			live := scenario == "referenced"
			var readErr error
			referenced := func(context.Context, kv.BlobKey) (bool, error) { return live, readErr }
			count, err := gc.Collect(t.Context(), now, time.Hour, false, referenced)
			require.NoError(t, err)
			require.Zero(t, count)
			count, err = gc.Collect(t.Context(), now.Add(time.Minute), time.Hour, false, referenced)
			require.NoError(t, err)
			require.Zero(t, count)
			switch scenario {
			case "read error":
				readErr = errors.New("unavailable")
			case "reference appears":
				live = true
			case "restart":
				gc = NewBlobGarbageCollector(store, 100, 0)
			}
			count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, scenario == "dry run", referenced)
			require.Equal(t, scenario == "read error", err != nil)
			expectedCount := 0
			if scenario == "orphan" || scenario == "dry run" || scenario == "restart" {
				expectedCount = 1
			}
			require.Equal(t, expectedCount, count)
			reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
			if scenario == "orphan" || scenario == "restart" {
				require.ErrorIs(t, err, kv.ErrNotFound)
			} else {
				require.NoError(t, err)
				require.NoError(t, reader.Close())
			}
		})
	}
}

func TestBlobGCPagedKeys(t *testing.T) {
	store := setupSqlKV(t)
	base := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "a"}
	for _, uid := range []string{"a", "a-long", "b"} {
		key := base
		key.UID = uid
		if uid == "a" {
			key.Name = "z-last-resource-first-uuid"
		}
		writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
		require.NoError(t, err)
		_, err = writer.Write(append(kv.EncodeBlobValueHeader("text/plain"), []byte("payload")...))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
	}
	now := time.Now()
	gc := NewBlobGarbageCollector(store, 1, 0)
	live := func(_ context.Context, key kv.BlobKey) (bool, error) { return key.UID == "b", nil }
	count, err := gc.Collect(t.Context(), now, time.Hour, false, live)
	require.NoError(t, err)
	require.Zero(t, count)
	gc = NewBlobGarbageCollector(store, 1, 0)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, true, live)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, live)
	require.NoError(t, err)
	require.Equal(t, 2, count)
	key := base
	key.UID = "b"
	reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())
}

func TestKVBlobGCOptInAndDryRun(t *testing.T) {
	b := setupTestStorageBackend(t)
	b.kv = setupSqlKV(t)
	b.dataStore = newDataStore(b.kv, nil)
	key := kv.BlobKey{Group: "group", Resource: "resource", Namespace: "default", Name: "snap", UID: "unreferenced"}
	writer, err := b.kv.Save(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	_, err = writer.Write(append(kv.EncodeBlobValueHeader("image/png"), []byte("image")...))
	require.NoError(t, err)
	require.NoError(t, writer.Close())

	b.garbageCollection.MaxAge = time.Nanosecond
	b.runGarbageCollection(t.Context(), time.Now().UnixMicro())
	require.Nil(t, b.blobGC)

	b.garbageCollection.BlobEnabled = true
	b.garbageCollection.BlobDryRun = true
	b.collectBlobs(t.Context())
	b.collectBlobs(t.Context())
	reader, err := b.kv.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())

	b.garbageCollection.BlobDryRun = false
	b.collectBlobs(t.Context())
	_, err = b.kv.Get(t.Context(), kv.BlobDataSection, key.String())
	require.ErrorIs(t, err, kv.ErrNotFound)
}

func TestBlobGCPreservesProvisioningPreviewURL(t *testing.T) {
	store := setupSqlKV(t)
	key := kv.BlobKey{Group: "provisioning.grafana.app", Resource: "repositories", Namespace: "default", Name: "repo", UID: "preview"}
	writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	_, err = writer.Write(append(kv.EncodeBlobValueHeader("image/png"), []byte("image")...))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	gc := NewBlobGarbageCollector(store, 100, 0)
	now := time.Now()
	for _, at := range []time.Time{now, now.Add(48 * time.Hour)} {
		count, err := gc.Collect(t.Context(), at, time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) {
			return false, nil // URL references are not in resource history
		})
		require.NoError(t, err)
		require.Zero(t, count)
	}
	reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
	require.NoError(t, err)
	require.NoError(t, reader.Close())
}

func TestCDKBlobGCStore(t *testing.T) {
	bucket, err := OpenBlobBucket(t.Context(), "mem://")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, bucket.Close()) })
	blobStore, err := NewCDKBlobSupport(t.Context(), CDKBlobSupportOptions{Bucket: bucket})
	require.NoError(t, err)
	resourceKey := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap"}
	response, err := blobStore.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{Resource: resourceKey, ContentType: "image/png", Value: []byte("image")})
	require.NoError(t, err)
	store := NewCDKBlobGCStore(bucket, "")
	gc := NewBlobGarbageCollector(store, 100, 0)
	now := time.Now()
	key := kv.BlobKey{Group: resourceKey.Group, Resource: resourceKey.Resource, Namespace: resourceKey.Namespace, Name: resourceKey.Name, UID: response.Uid}
	count, err := gc.Collect(t.Context(), now, time.Hour, false, func(_ context.Context, got kv.BlobKey) (bool, error) {
		require.Equal(t, key, got)
		return false, nil
	})
	require.NoError(t, err)
	require.Zero(t, count)
	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = blobStore.GetResourceBlob(t.Context(), resourceKey, &utils.BlobInfo{UID: response.Uid, MimeType: "image/png"}, true)
	require.Error(t, err)

	preview := &resourcepb.ResourceKey{Group: "provisioning.grafana.app", Resource: "repositories", Namespace: "", Name: "repo"}
	previewResponse, err := blobStore.PutResourceBlob(t.Context(), &resourcepb.PutBlobRequest{Resource: preview, ContentType: "image/png", Value: []byte("preview")})
	require.NoError(t, err)
	for _, at := range []time.Time{now.Add(3 * time.Hour), now.Add(48 * time.Hour)} {
		count, err = gc.Collect(t.Context(), at, time.Hour, false, func(context.Context, kv.BlobKey) (bool, error) { return false, nil })
		require.NoError(t, err)
		require.Zero(t, count)
	}
	value, err := blobStore.GetResourceBlob(t.Context(), preview, &utils.BlobInfo{UID: previewResponse.Uid, MimeType: "image/png"}, true)
	require.NoError(t, err)
	require.Equal(t, []byte("preview"), value.Value)
}

func TestBlobReferencedPreservesHistory(t *testing.T) {
	store := setupBadgerKV(t)
	backend := &kvStorageBackend{dataStore: &dataStore{kv: store}}
	blob := kv.BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap", UID: "blob"}
	old := DataKey{Group: blob.Group, Resource: blob.Resource, Namespace: blob.Namespace, Name: blob.Name, ResourceVersion: 1, Action: DataActionCreated}
	newer := old
	newer.ResourceVersion = 2
	newer.Action = DataActionDeleted
	for _, revision := range []struct {
		key   DataKey
		value string
	}{
		{old, `{"blobs":{"dashboard":{"uid":"blob"}}}`},
		{newer, `{"metadata":{}}`},
	} {
		writer, err := store.Save(t.Context(), kv.DataSection, revision.key.String())
		require.NoError(t, err)
		_, err = writer.Write([]byte(revision.value))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
	}
	live, err := backend.blobReferenced(t.Context(), blob)
	require.NoError(t, err)
	require.True(t, live)
	require.NoError(t, store.Delete(t.Context(), kv.DataSection, old.String()))
	live, err = backend.blobReferenced(t.Context(), blob)
	require.NoError(t, err)
	require.False(t, live)
}
