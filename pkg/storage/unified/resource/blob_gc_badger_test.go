package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
)

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
