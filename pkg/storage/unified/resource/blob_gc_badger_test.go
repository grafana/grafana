package resource

import (
	"context"
	"io"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

type blobCollector interface {
	FirstUnused(context.Context, string, time.Time) (time.Time, error)
	CollectUnused(context.Context, string, time.Time) (bool, error)
}

func writeBadgerBlob(t *testing.T, store kv.KV, key, payload string) {
	t.Helper()
	writer, err := store.Save(t.Context(), kv.BlobDataSection, key)
	require.NoError(t, err)
	_, err = writer.Write([]byte(payload))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
}

func TestBlobGCCollectUnusedSkipsReupload(t *testing.T) {
	store := setupBadgerKV(t)
	collector := store.(blobCollector)
	key := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "uid"}.String()

	writeBadgerBlob(t, store, key, "first")
	now := time.Now()
	first, err := collector.FirstUnused(t.Context(), key, now)
	require.NoError(t, err)

	writeBadgerBlob(t, store, key, "reuploaded")

	deleted, err := collector.CollectUnused(t.Context(), key, first)
	require.NoError(t, err)
	require.False(t, deleted)

	reader, err := store.Get(t.Context(), kv.BlobDataSection, key)
	require.NoError(t, err)
	data, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.NoError(t, reader.Close())
	require.Equal(t, "reuploaded", string(data))
}

func TestBlobGCCollectsExpiredBadgerBlob(t *testing.T) {
	store := setupBadgerKV(t)
	key := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "uid"}.String()
	writeBadgerBlob(t, store, key, "payload")

	gc := NewBlobGarbageCollector(store, 1, 0)
	now := time.Now()
	referenced := func(context.Context, kv.BlobKey) (bool, error) { return false, nil }

	count, err := gc.Collect(t.Context(), now, time.Hour, false, referenced)
	require.NoError(t, err)
	require.Zero(t, count)

	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, referenced)
	require.NoError(t, err)
	require.Equal(t, 1, count)

	_, err = store.Get(t.Context(), kv.BlobDataSection, key)
	require.ErrorIs(t, err, kv.ErrNotFound)
}

func TestBlobGCReferenceResetsObservation(t *testing.T) {
	store := setupBadgerKV(t)
	key := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "uid"}.String()
	writer, err := store.Save(t.Context(), kv.BlobDataSection, key)
	require.NoError(t, err)
	_, err = writer.Write([]byte("payload"))
	require.NoError(t, err)
	require.NoError(t, writer.Close())
	gc := NewBlobGarbageCollector(store, 1, 0)
	now := time.Now()
	live := false
	referenced := func(context.Context, kv.BlobKey) (bool, error) { return live, nil }
	_, err = gc.Collect(t.Context(), now, time.Hour, false, referenced)
	require.NoError(t, err)
	live = true
	_, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, referenced)
	require.NoError(t, err)
	live = false
	count, err := gc.Collect(t.Context(), now.Add(3*time.Hour), time.Hour, false, referenced)
	require.NoError(t, err)
	require.Zero(t, count)
}

func TestBlobGCReuploadResetsObservation(t *testing.T) {
	store := setupBadgerKV(t)
	key := kv.BlobKey{Group: "group", Resource: "resource", Name: "name", UID: "uid"}.String()
	write := func() {
		writer, err := store.Save(t.Context(), kv.BlobDataSection, key)
		require.NoError(t, err)
		_, err = writer.Write([]byte("payload"))
		require.NoError(t, err)
		require.NoError(t, writer.Close())
	}
	write()
	gc := NewBlobGarbageCollector(store, 1, 0)
	now := time.Now()
	referenced := func(context.Context, kv.BlobKey) (bool, error) { return false, nil }
	_, err := gc.Collect(t.Context(), now, time.Hour, false, referenced)
	require.NoError(t, err)
	write()
	count, err := gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, referenced)
	require.NoError(t, err)
	require.Zero(t, count)
}
