package resource

import (
	"fmt"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

// cachedLen counts the events cached across all collections.
func (c *watchCache[T]) cachedLen() int {
	n := 0
	for _, ring := range c.rings {
		n += ring.len
	}
	return n
}

func TestWatchCacheReplayAndValidity(t *testing.T) {
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	unknown := GroupResource{Group: "g", Resource: "unknown"}
	cache := newWatchCache(2, writtenEventIdentity)
	require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{
		items: []*WrittenEvent{cacheEvent(first, 50), cacheEvent(second, 60)}, initialCacheFloor: 40,
	}))
	validate := func(gr GroupResource, since int64) error {
		return cache.validateResume(gr, watchResume{since: since, requestedRV: since})
	}
	require.True(t, IsResourceVersionExpired(validate(unknown, 39)))
	require.NoError(t, validate(unknown, 40))

	cache.add(cacheEvent(second, 70))
	cache.add(cacheEvent(second, 80))
	// Evicting second's events leaves first's floor untouched.
	require.True(t, IsResourceVersionExpired(validate(first, 39)))
	require.NoError(t, validate(first, 40))
	require.True(t, IsResourceVersionExpired(validate(second, 59)))
	require.NoError(t, validate(second, 60))
	require.NoError(t, validate(unknown, 40))

	replayed := make(chan *WrittenEvent, 2)
	require.NoError(t, cache.replay(replayed, second, 0))
	require.Equal(t, int64(70), (<-replayed).ResourceVersion)
	require.Equal(t, int64(80), (<-replayed).ResourceVersion)
	require.NoError(t, cache.replay(replayed, first, 0))
	require.Equal(t, int64(50), (<-replayed).ResourceVersion)
	require.NoError(t, cache.replay(replayed, unknown, 0))
	require.Empty(t, replayed)
	require.ErrorIs(t, cache.replay(make(chan *WrittenEvent, 1), second, 0), io.ErrShortBuffer)
}

func TestWatchCacheByteLimit(t *testing.T) {
	for _, mode := range []string{"live", "seeded"} {
		t.Run(mode, func(t *testing.T) {
			first := GroupResource{Group: "g", Resource: "first"}
			second := GroupResource{Group: "g", Resource: "second"}
			a, b, c := cacheEvent(first, 50), cacheEvent(second, 60), cacheEvent(second, 70)
			a.Value = make([]byte, 1024)
			b.Value = make([]byte, 1024)
			c.Value = make([]byte, 2048)
			cache := newWatchCache(3, writtenEventIdentity)
			cache.maxBytes = a.sizeBytes() + b.sizeBytes()
			if mode == "seeded" {
				require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{items: []*WrittenEvent{a, b, c}, initialCacheFloor: 40}))
			} else {
				require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{initialCacheFloor: 40}))
				cache.add(a)
				cache.add(b)
				require.Equal(t, cache.maxBytes, cache.sizeBytes)
				cache.add(c)
			}
			require.Equal(t, c.sizeBytes(), cache.sizeBytes)
			require.Equal(t, 1, cache.cachedLen())
			require.Empty(t, replayRVs(t, &cache, first))
			require.Equal(t, []int64{70}, replayRVs(t, &cache, second))
			for gr, rv := range map[GroupResource]int64{first: 50, second: 60} {
				require.True(t, IsResourceVersionExpired(cache.validateResume(gr, watchResume{since: rv - 1})))
				require.NoError(t, cache.validateResume(gr, watchResume{since: rv}))
			}
		})
	}
}

func TestWatchCacheOversizedEvent(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(1, writtenEventIdentity)
	first := cacheEvent(gr, 50)
	first.Value = make([]byte, 16)
	cache.maxBytes = first.sizeBytes()
	cache.add(first)
	large := cacheEvent(gr, 60)
	large.Value = make([]byte, 1, 1024)
	cache.add(large)
	// An event that cannot be cached evicts nothing to make room for itself.
	require.Equal(t, 1, cache.cachedLen())
	require.Equal(t, first.sizeBytes(), cache.sizeBytes)
	require.True(t, IsResourceVersionExpired(cache.validateResume(gr, watchResume{since: 59})))
	require.NoError(t, cache.validateResume(gr, watchResume{since: 60}))

	next := cacheEvent(gr, 70)
	next.Value = make([]byte, 16)
	cache.add(next)
	require.Equal(t, next.sizeBytes(), cache.sizeBytes)
	replayed := make(chan *WrittenEvent, 3)
	require.NoError(t, cache.replay(replayed, gr, 0))
	require.Equal(t, []*WrittenEvent{next}, drainChan(replayed))
}

func TestWatchCacheByteAccountingWraparound(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(3, writtenEventIdentity)
	cache.maxBytes = 2
	for rv := int64(1); rv <= 20; rv++ {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, 1)
		cache.add(event)
		require.LessOrEqual(t, cache.sizeBytes, cache.maxBytes)
		replayed := make(chan *WrittenEvent, 3)
		require.NoError(t, cache.replay(replayed, gr, 0))
		items := drainChan(replayed)
		require.Len(t, items, min(int(rv), 2))
		var total int64
		for i, item := range items {
			total += item.sizeBytes()
			require.Equal(t, rv-int64(len(items)-1-i), item.ResourceVersion)
		}
		require.Equal(t, total, cache.sizeBytes)
	}
}

func TestWrittenEventSizeBytes(t *testing.T) {
	var event *WrittenEvent
	require.Zero(t, event.sizeBytes())
	event = cacheEvent(GroupResource{Group: "group", Resource: "resource"}, 50)
	event.Folder = "folder"
	event.PreviousFolder = "previous"
	event.PreviousAction = DataActionUpdated
	require.Zero(t, event.sizeBytes(), "metadata does not count toward the payload limit")
	event.Value = make([]byte, 1, 1024)
	require.Equal(t, int64(1024), event.sizeBytes())
}

func TestWatchCacheCollectionFloors(t *testing.T) {
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	unknown := GroupResource{Group: "g", Resource: "unknown"}
	cache := newWatchCache(2, writtenEventIdentity)
	require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{
		collectionFloors: map[GroupResource]int64{first: 1000, second: 50},
	}))
	validate := func(gr GroupResource, since int64) error {
		return cache.validateResume(gr, watchResume{since: since, requestedRV: since})
	}
	// Per-collection RVs are not comparable, so each collection has its own floor.
	require.True(t, IsResourceVersionExpired(validate(first, 999)))
	require.NoError(t, validate(first, 1000))
	require.True(t, IsResourceVersionExpired(validate(second, 49)))
	require.NoError(t, validate(second, 50))
	// A collection without writes before the stream started has every write.
	require.NoError(t, validate(unknown, 1))

	// A late arrival evicted after a higher RV must not lower the floor.
	cache.add(cacheEvent(second, 80))
	cache.add(cacheEvent(second, 70))
	cache.add(cacheEvent(second, 90))
	cache.add(cacheEvent(second, 100))
	require.True(t, IsResourceVersionExpired(validate(second, 79)))
	require.NoError(t, validate(second, 80))
}

func TestWatchCacheRejectsOversizedSeed(t *testing.T) {
	cache := newWatchCache(1, intIdentity)
	require.ErrorContains(t, cache.seed(cacheSeed[int]{items: []int{1, 2}, initialCacheFloor: 50}), "cache capacity")
	require.Empty(t, cache.rings)
	require.Zero(t, cache.initialFloor)
}

func replayRVs(t *testing.T, cache *watchCache[*WrittenEvent], gr GroupResource) []int64 {
	t.Helper()
	replayed := make(chan *WrittenEvent, cache.size)
	require.NoError(t, cache.replay(replayed, gr, 0))
	events := drainChan(replayed)
	if len(events) == 0 {
		return nil
	}
	out := make([]int64, 0, len(events))
	for _, event := range events {
		out = append(out, event.ResourceVersion)
	}
	return out
}

func TestWatchCacheCountLimits(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	incoming := GroupResource{Group: "g", Resource: "incoming"}
	cache := newWatchCache(2, writtenEventIdentity)
	cache.maxEvents = 4
	cache.add(cacheEvent(quiet, 10))
	cache.add(cacheEvent(busy, 20))
	cache.add(cacheEvent(quiet, 11))
	cache.add(cacheEvent(busy, 21))

	// A full collection evicts its own oldest event, even from the middle
	// of the shared FIFO. This also makes room under the shared count limit.
	cache.add(cacheEvent(busy, 22))
	require.Equal(t, []int64{10, 11}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{21, 22}, replayRVs(t, &cache, busy))
	require.True(t, IsResourceVersionExpired(cache.validateResume(busy, watchResume{since: 19})))
	require.NoError(t, cache.validateResume(busy, watchResume{since: 20}))

	// A new collection at the shared limit evicts the oldest retained event.
	cache.add(cacheEvent(incoming, 30))
	require.Equal(t, 4, cache.count)
	require.Equal(t, cache.cachedLen(), cache.count)
	require.Equal(t, []int64{11}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{21, 22}, replayRVs(t, &cache, busy))
	require.Equal(t, []int64{30}, replayRVs(t, &cache, incoming))
	require.True(t, IsResourceVersionExpired(cache.validateResume(quiet, watchResume{since: 9})))
	require.NoError(t, cache.validateResume(quiet, watchResume{since: 10}))
}

func TestWatchCacheDropsEmptyCollections(t *testing.T) {
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxEvents = 1
	cache.add(cacheEvent(first, 10))
	cache.add(cacheEvent(second, 11))
	require.NotContains(t, cache.rings, first, "an emptied collection must not keep its ring")
	require.Equal(t, []int64{11}, replayRVs(t, &cache, second))
	require.True(t, IsResourceVersionExpired(cache.validateResume(first, watchResume{since: 9})))
	require.NoError(t, cache.validateResume(first, watchResume{since: 10}))

	// The incoming collection's own ring can be the one emptied to make room.
	cache.add(cacheEvent(second, 12))
	require.Equal(t, []int64{12}, replayRVs(t, &cache, second))
}

func BenchmarkWatchCacheAddFullRing(b *testing.B) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
	events := make([]*WrittenEvent, 2*defaultCacheSize)
	for i := range events {
		events[i] = cacheEvent(gr, int64(i+1))
		events[i].Value = make([]byte, 64)
	}
	for _, event := range events[:defaultCacheSize] {
		cache.add(event)
	}
	b.ReportAllocs()
	i := 0
	for b.Loop() {
		cache.add(events[i%len(events)])
		i++
	}
}

func BenchmarkWatchCacheByteCappedRotation(b *testing.B) {
	const collections, perCollection, size = 500, 4, 32 * 1024
	cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
	cache.maxBytes = collections * perCollection * size
	cache.maxEvents = 10 * collections * perCollection
	grs := make([]GroupResource, collections)
	for i := range grs {
		grs[i] = GroupResource{Group: "g", Resource: fmt.Sprint("r-", i)}
	}
	value := make([]byte, size)
	events := make([]*WrittenEvent, 4*collections)
	for i := range events {
		events[i] = cacheEvent(grs[i%collections], int64(i+1))
		events[i].Value = value
	}
	rv := int64(len(events))
	for range perCollection {
		for _, gr := range grs {
			rv++
			event := cacheEvent(gr, rv)
			event.Value = value
			cache.add(event)
		}
	}
	b.ReportAllocs()
	i := 0
	for b.Loop() {
		cache.add(events[i%len(events)])
		i++
	}
}

func TestWatchCacheRingsGrowAsEventsArrive(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
	cache.add(cacheEvent(gr, 1))
	require.Less(t, len(cache.rings[gr].buf), defaultCacheSize, "one event must not reserve every slot")
	for rv := int64(2); rv <= 2*defaultCacheSize; rv++ {
		cache.add(cacheEvent(gr, rv))
	}
	require.Len(t, cache.rings[gr].buf, defaultCacheSize)
	require.Equal(t, defaultCacheSize, cache.rings[gr].len)
	replayed := replayRVs(t, &cache, gr)
	require.Len(t, replayed, defaultCacheSize)
	require.Equal(t, int64(defaultCacheSize+1), replayed[0])
	require.Equal(t, int64(2*defaultCacheSize), replayed[len(replayed)-1])
}
