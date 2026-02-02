package resource

import (
	"fmt"
	"iter"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
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
	store := newLastImportStore(kv, 10*time.Minute, log.NewNopLogger())

	dnsr := NamespacedResource{Namespace: "namespace", Group: "dashboards", Resource: "dashboard"}

	fnsr := NamespacedResource{Namespace: "namespace", Group: "folders", Resource: "folder"}

	pnsr := NamespacedResource{Namespace: "namespace", Group: "playlists", Resource: "playlist"}

	now := time.Now().Truncate(time.Millisecond).UTC()

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-15 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-5 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(5 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-12 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-7 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(2 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: pnsr, LastImportTime: now.Add(-20 * time.Minute)}))

	// SQLKV only stores a single import time per namespace/group/resource.
	expectedKeys := []string{
		fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).UnixMilli()),
		fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).UnixMilli()),
		fmt.Sprintf("namespace~playlists~playlist~%d", now.Add(-20*time.Minute).UnixMilli()),
	}
	if allowDuplicateNamespaceGroupResource {
		// Regular KV store keeps all previous import times, until they are deleted.
		expectedKeys = []string{
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(-12*time.Minute).UnixMilli()),
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(-7*time.Minute).UnixMilli()),
			fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).UnixMilli()),

			fmt.Sprintf("namespace~folders~folder~%d", now.Add(-15*time.Minute).UnixMilli()),
			fmt.Sprintf("namespace~folders~folder~%d", now.Add(-5*time.Minute).UnixMilli()),
			fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).UnixMilli()),

			fmt.Sprintf("namespace~playlists~playlist~%d", now.Add(-20*time.Minute).UnixMilli()),
		}
	}
	require.Equal(t, expectedKeys, collectKeys(t, store.kv.Keys(t.Context(), lastImportTimesSection, ListOptions{})))

	expectedTimes := []ResourceLastImportTime{
		{NamespacedResource: dnsr, LastImportTime: now.Add(2 * time.Minute)},
		{NamespacedResource: fnsr, LastImportTime: now.Add(5 * time.Minute)},
	}

	times, err := store.ListLastImportTimes(t.Context())
	require.NoError(t, err)
	require.ElementsMatch(t, expectedTimes, times)

	// Verify that all other times were deleted.
	expectedKeysAfterList := []string{
		fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).UnixMilli()),
		fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).UnixMilli()),
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
