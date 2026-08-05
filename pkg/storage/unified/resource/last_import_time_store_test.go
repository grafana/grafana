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

	// Namespaces in a prefix relationship: "org" is a prefix of "org1". Sorting
	// by the separate namespace/group/resource columns places "org" before
	// "org1", but byte-wise ordering of the full composite key places
	// "org1~..." before "org~..." because '~' (0x7E) sorts above '1' (0x31).
	// All KV backends must agree on the byte-wise order.
	onsr := NamespacedResource{Namespace: "org", Group: "dashboards", Resource: "dashboard"}
	o1nsr := NamespacedResource{Namespace: "org1", Group: "dashboards", Resource: "dashboard"}

	now := time.Now().Truncate(time.Second).UTC()

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-15 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(-5 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: fnsr, LastImportTime: now.Add(5 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-12 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(-7 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: dnsr, LastImportTime: now.Add(2 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: pnsr, LastImportTime: now.Add(-20 * time.Minute)}))

	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: onsr, LastImportTime: now.Add(1 * time.Minute)}))
	require.NoError(t, store.Save(t.Context(), ResourceLastImportTime{NamespacedResource: o1nsr, LastImportTime: now.Add(1 * time.Minute)}))

	// Keys are returned in byte-wise order of the full composite key, so
	// "org1~..." precedes "org~...".
	// SQLKV only stores a single import time per namespace/group/resource.
	expectedKeys := []string{
		fmt.Sprintf("namespace~dashboards~dashboard~%d", now.Add(2*time.Minute).Unix()),
		fmt.Sprintf("namespace~folders~folder~%d", now.Add(5*time.Minute).Unix()),
		fmt.Sprintf("namespace~playlists~playlist~%d", now.Add(-20*time.Minute).Unix()),
		fmt.Sprintf("org1~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
		fmt.Sprintf("org~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
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

			fmt.Sprintf("org1~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
			fmt.Sprintf("org~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
		}
	}
	require.Equal(t, expectedKeys, collectKeys(t, store.kv.Keys(t.Context(), lastImportTimesSection, ListOptions{})))

	expectedTimes := map[NamespacedResource]LastImportTimeKey{
		dnsr:  {Namespace: dnsr.Namespace, Group: dnsr.Group, Resource: dnsr.Resource, LastImportTime: now.Add(2 * time.Minute)},
		fnsr:  {Namespace: fnsr.Namespace, Group: fnsr.Group, Resource: fnsr.Resource, LastImportTime: now.Add(5 * time.Minute)},
		onsr:  {Namespace: onsr.Namespace, Group: onsr.Group, Resource: onsr.Resource, LastImportTime: now.Add(1 * time.Minute)},
		o1nsr: {Namespace: o1nsr.Namespace, Group: o1nsr.Group, Resource: o1nsr.Resource, LastImportTime: now.Add(1 * time.Minute)},
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
		fmt.Sprintf("org1~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
		fmt.Sprintf("org~dashboards~dashboard~%d", now.Add(1*time.Minute).Unix()),
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
