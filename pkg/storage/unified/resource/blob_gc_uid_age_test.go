package resource

import (
	"context"
	"testing"
	"time"
	"uuid"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

func saveTestBlob(t *testing.T, store kv.KV, uid string) string {
	t.Helper()
	key := kv.BlobKey{Group: "g", Resource: "r", Namespace: "ns", Name: "n", UID: uid}.String()
	w, err := store.Save(t.Context(), kv.BlobDataSection, key)
	require.NoError(t, err)
	_, err = w.Write(append(kv.EncodeBlobValueHeader("text/plain"), "x"...))
	require.NoError(t, err)
	require.NoError(t, w.Close())
	return key
}

func TestUUIDV7Time(t *testing.T) {
	before := time.Now().Add(-time.Second)
	got, ok := uuidV7Time(uuid.NewV7().String())
	require.True(t, ok)
	require.WithinDuration(t, time.Now(), got, 2*time.Second)
	require.True(t, got.After(before))
	_, ok = uuidV7Time(uuid.NewV4().String())
	require.False(t, ok)
	_, ok = uuidV7Time("blob")
	require.False(t, ok)
}

func TestBlobGCPlainKVUsesUIDAge(t *testing.T) {
	store := setupBadgerKV(t)
	gc := NewBlobGarbageCollector(store, 10, 0)
	unref := func(context.Context, kv.BlobKey) (bool, error) { return false, nil }
	oldKey := saveTestBlob(t, store, uuid.NewV7().String())
	now := time.Now()

	count, err := gc.Collect(t.Context(), now, time.Hour, false, unref)
	require.NoError(t, err)
	require.Zero(t, count, "within grace")

	count, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, unref)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = store.Get(t.Context(), kv.BlobDataSection, oldKey)
	require.ErrorIs(t, err, kv.ErrNotFound)
}

func TestBlobGCPlainKVLegacyUIDUsesFirstSeen(t *testing.T) {
	store := setupBadgerKV(t)
	gc := NewBlobGarbageCollector(store, 10, 0)
	live := false
	ref := func(context.Context, kv.BlobKey) (bool, error) { return live, nil }
	key := saveTestBlob(t, store, uuid.NewV4().String())
	now := time.Now()

	count, err := gc.Collect(t.Context(), now, time.Hour, false, ref)
	require.NoError(t, err)
	require.Zero(t, count, "first sighting starts the clock")

	live = true // reference resets the clock
	_, err = gc.Collect(t.Context(), now.Add(2*time.Hour), time.Hour, false, ref)
	require.NoError(t, err)
	live = false
	count, err = gc.Collect(t.Context(), now.Add(3*time.Hour), time.Hour, false, ref)
	require.NoError(t, err)
	require.Zero(t, count)

	count, err = gc.Collect(t.Context(), now.Add(5*time.Hour), time.Hour, false, ref)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	_, err = store.Get(t.Context(), kv.BlobDataSection, key)
	require.ErrorIs(t, err, kv.ErrNotFound)
}
