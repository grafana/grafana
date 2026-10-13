package resource

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
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
			store := setupBadgerKV(t)
			key := kv.BlobKey{Group: "dashboard.grafana.app", Resource: "snapshots", Namespace: "default", Name: "snap", UID: "blob"}
			writer, err := store.Save(t.Context(), kv.BlobDataSection, key.String())
			require.NoError(t, err)
			_, err = writer.Write([]byte("payload"))
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
			if scenario == "orphan" || scenario == "dry run" {
				expectedCount = 1
			}
			require.Equal(t, expectedCount, count)
			reader, err := store.Get(t.Context(), kv.BlobDataSection, key.String())
			if scenario == "orphan" {
				require.ErrorIs(t, err, kv.ErrNotFound)
			} else {
				require.NoError(t, err)
				require.NoError(t, reader.Close())
			}
		})
	}
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
