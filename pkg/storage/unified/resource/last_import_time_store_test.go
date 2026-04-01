package resource

import (
	"fmt"
	"iter"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationLastImportTimeStore(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testLastImportStore(t, setupSqlKV(t), false)
}

func TestLastImportStore(t *testing.T) {
	testLastImportStore(t, setupBadgerKV(t), true)
}

func testLastImportStore(t *testing.T, kv kv.KV, allowDuplicateNamespaceGroupResource bool) {
	const maxLastImportTimeAge = 10 * time.Minute

	store := newLastImportStore(kv)

	dnsr := NamespacedResource{Namespace: "namespace", Group: "dashboards", Resource: "dashboard"}
	fnsr := NamespacedResource{Namespace: "namespace", Group: "folders", Resource: "folder"}
	pnsr := NamespacedResource{Namespace: "namespace", Group: "playlists", Resource: "playlist"}

	now := time.Now().Truncate(time.Second).UTC()

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-15 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-5 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(5 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-12 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-7 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(2 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: pnsr, LastImportTime: now.Add(-20 * time.Minute)}))

	// SQLKV only stores a single import time per namespace/group/resource.
	expectedKeys := []string{
		fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).Unix()),
		fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).Unix()),
		fmt.Sprintf("namespace~playlists~playlist~%d", now.Add(-20*time.Minute).Unix()),
	}
	if allowDuplicateNamespaceGroupResource {
		// Regular KV store keeps all previous import times, until they are deleted.
		expectedKeys = []string{
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(-12*time.Minute).Unix()),
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(-7*time.Minute).Unix()),
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).Unix()),

			fmt.Sprintf("namespace~folders~folder~%d", now.Add(-15*time.Minute).Unix()),
			fmt.Sprintf("namespace~folders~folder~%d", now.Add(-5*time.Minute).Unix()),
			fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).Unix()),

			fmt.Sprintf("namespace~playlists~playlist~%d", now.Add(-20*time.Minute).Unix()),
		}
	}
	require.Equal(t, expectedKeys, collectKeys(t, store.kv.Keys(t.Context(), lastImportTimesSection, ListOptions{})))

	expectedTimes := map[NamespacedResource]LastImportTimeKey{
		dnsr: {Namespace: dnsr.Namespace, Group: dnsr.Group, Resource: dnsr.Resource, LastImportTime: now.Add(2 * time.Minute)},
		fnsr: {Namespace: fnsr.Namespace, Group: fnsr.Group, Resource: fnsr.Resource, LastImportTime: now.Add(5 * time.Minute)},
	}

	times, _, err := store.ListLastImportTimes(t.Context(), maxLastImportTimeAge)
	require.NoError(t, err)
	require.Equal(t, expectedTimes, times)

	deleted, err := store.CleanupLastImportTimes(t.Context(), maxLastImportTimeAge)
	require.NoError(t, err)
	require.NotZero(t, deleted) // Deleted will be 1 for sqlkv, but 5 for regular KV.

	// Verify that all other times were deleted.
	expectedKeysAfterList := []string{
		fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).Unix()),
		fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).Unix()),
	}
	require.Equal(t, expectedKeysAfterList, collectKeys(t, store.kv.Keys(t.Context(), lastImportTimesSection, ListOptions{})))
}

func collectKeys(t *testing.T, keys iter.Seq2[string, error]) []string {
	result := []string(nil)
	for k, err := range keys {
		require.NoError(t, err)
		result = append(result, k)
	}
	return result
}
