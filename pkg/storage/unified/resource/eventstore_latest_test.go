package resource

import (
	"fmt"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/util/testutil"
)

func durableWatchEvent(rv int64) Event {
	return Event{Namespace: watchTestNamespace, Group: watchTestGroup, Resource: watchTestResource,
		Name: fmt.Sprintf("playlist-%d", rv), ResourceVersion: rv, Action: DataActionCreated}
}

func TestIntegrationEventStoreLatestThroughRV(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	for _, store := range []struct {
		name  string
		setup func(*testing.T) KV
	}{
		{name: "badger", setup: setupBadgerKV},
		{name: "sqlkv", setup: setupSqlKV},
	} {
		t.Run(store.name, func(t *testing.T) {
			probe := &eventStoreKVProbe{KV: store.setup(t), t: t}
			events := newEventStore(probe)
			base := snowflakeFromTime(time.Now().Add(-time.Hour))
			const count = 2*defaultCacheSize + 3
			for i := range count {
				event := durableWatchEvent(base + int64(i))
				if i%2 == 0 {
					event.Namespace = ""
				}
				require.NoError(t, events.Save(t.Context(), event))
			}

			for _, tc := range []struct {
				name    string
				through int64
				first   int
				count   int
			}{
				{name: "empty range", through: base - 1},
				{name: "short range including boundary", through: base + 2, count: 3},
				{name: "limit applies below boundary", through: base + defaultCacheSize, first: 1, count: defaultCacheSize},
				{name: "boundary absent from metadata", through: base + count, first: count - defaultCacheSize, count: defaultCacheSize},
				{name: "max int64 boundary", through: math.MaxInt64, first: count - defaultCacheSize, count: defaultCacheSize},
			} {
				t.Run(tc.name, func(t *testing.T) {
					probe.scans = nil
					retained, err := events.latest(t.Context(), defaultCacheSize, tc.through)
					require.NoError(t, err)
					require.Len(t, retained, tc.count)
					for i, event := range retained {
						require.Equal(t, base+int64(tc.first+i), event.ResourceVersion)
						require.LessOrEqual(t, event.ResourceVersion, tc.through)
					}
					expectedOptions := ListOptions{Sort: SortOrderDesc, Limit: defaultCacheSize}
					if tc.through != math.MaxInt64 {
						expectedOptions.EndKey = fmt.Sprintf("%d", tc.through+1)
					}
					require.Equal(t, []ListOptions{expectedOptions}, probe.scans)
					probe.assertClosed()
				})
			}
		})
	}
}
