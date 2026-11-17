package resource

import (
	"fmt"
	"io"
	"math/rand/v2"
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
	require.NoError(t, cache.replay(replayed, second))
	require.Equal(t, int64(70), (<-replayed).ResourceVersion)
	require.Equal(t, int64(80), (<-replayed).ResourceVersion)
	require.NoError(t, cache.replay(replayed, first))
	require.Equal(t, int64(50), (<-replayed).ResourceVersion)
	require.NoError(t, cache.replay(replayed, unknown))
	require.Empty(t, replayed)
	require.ErrorIs(t, cache.replay(make(chan *WrittenEvent, 1), second), io.ErrShortBuffer)
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
			// Evicting b is not enough room for c, which alone uses more bytes
			// than first, so c stays uncached and nothing is evicted for it.
			require.Equal(t, a.sizeBytes()+b.sizeBytes(), cache.sizeBytes)
			require.Equal(t, 2, cache.cachedLen())
			for _, ring := range cache.rings {
				for _, item := range ring.buf {
					require.True(t, item == nil || item == a || item == b, "an uncached event must not be retained")
				}
			}
			replayed := make(chan *WrittenEvent, 3)
			require.NoError(t, cache.replay(replayed, first))
			require.Equal(t, []*WrittenEvent{a}, drainChan(replayed))
			for gr, rv := range map[GroupResource]int64{first: 40, second: 70} {
				require.True(t, IsResourceVersionExpired(cache.validateResume(gr, watchResume{since: rv - 1})))
				require.NoError(t, cache.validateResume(gr, watchResume{since: rv}))
			}
		})
	}
}

func TestWatchCacheOversizedEvent(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(3, writtenEventIdentity)
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
	require.NoError(t, cache.replay(replayed, gr))
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
		require.NoError(t, cache.replay(replayed, gr))
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

func TestWatchCacheEvictionFloorDoesNotRegress(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(1, writtenEventIdentity)
	for _, rv := range []int64{100, 50, 60} {
		cache.add(cacheEvent(gr, rv))
	}
	require.True(t, IsResourceVersionExpired(cache.validateResume(gr, watchResume{since: 99})))
	require.NoError(t, cache.validateResume(gr, watchResume{since: 100}))
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

func TestWatchCacheByteEvictionRaisesCollectionFloor(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(10, writtenEventIdentity)
	require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{collectionFloors: map[GroupResource]int64{gr: 50}}))
	validate := func(since int64) error {
		return cache.validateResume(gr, watchResume{since: since, requestedRV: since})
	}

	first := cacheEvent(gr, 80)
	first.Value = make([]byte, 1024)
	cache.maxBytes = first.sizeBytes()
	cache.add(first)
	next := cacheEvent(gr, 90)
	next.Value = make([]byte, 1024)
	// The byte limit, not the count, evicts the first event.
	cache.add(next)
	require.Equal(t, 1, cache.cachedLen())
	require.True(t, IsResourceVersionExpired(validate(79)))
	require.NoError(t, validate(80))

	// An event too large to cache raises the floor too.
	huge := cacheEvent(gr, 100)
	huge.Value = make([]byte, 4096)
	cache.add(huge)
	require.True(t, IsResourceVersionExpired(validate(99)))
	require.NoError(t, validate(100))
}

func TestWatchCacheRejectsOversizedSeed(t *testing.T) {
	cache := newWatchCache(1, intIdentity)
	require.ErrorContains(t, cache.seed(cacheSeed[int]{items: []int{1, 2}, initialCacheFloor: 50}), "cache capacity")
	require.Empty(t, cache.rings)
	require.Zero(t, cache.initialFloor)
}

func TestWatchCacheByteBudgetEvictsLargestCollection(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	sized := func(gr GroupResource, rv int64) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, 1024)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxBytes = 4 * 1024
	cache.add(sized(quiet, 10))
	for rv := int64(11); rv <= 20; rv++ {
		cache.add(sized(busy, rv))
		require.LessOrEqual(t, cache.sizeBytes, cache.maxBytes)
	}
	// A burst that fills the shared budget evicts its own collection's events.
	require.Equal(t, []int64{10}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{18, 19, 20}, replayRVs(t, &cache, busy))
	require.NoError(t, cache.validateResume(quiet, watchResume{since: 0}))
	require.True(t, IsResourceVersionExpired(cache.validateResume(busy, watchResume{since: 16})))
	require.NoError(t, cache.validateResume(busy, watchResume{since: 17}))
}

func TestWatchCacheCountLimitIsPerCollection(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	cache := newWatchCache(2, writtenEventIdentity)
	cache.add(cacheEvent(quiet, 10))
	for rv := int64(11); rv <= 20; rv++ {
		cache.add(cacheEvent(busy, rv))
	}
	require.Equal(t, []int64{10}, replayRVs(t, &cache, quiet))
	require.NoError(t, cache.validateResume(quiet, watchResume{since: 0}))
}

func TestWatchCacheMaxRVIgnoresLateEvents(t *testing.T) {
	gr := GroupResource{Group: "g", Resource: "r"}
	cache := newWatchCache(3, writtenEventIdentity)
	cache.add(cacheEvent(gr, 20))
	cache.add(cacheEvent(gr, 10))
	require.Equal(t, int64(20), cache.maxRV)
}

func replayRVs(t *testing.T, cache *watchCache[*WrittenEvent], gr GroupResource) []int64 {
	t.Helper()
	replayed := make(chan *WrittenEvent, cache.size)
	require.NoError(t, cache.replay(replayed, gr))
	events := drainChan(replayed)
	out := make([]int64, 0, len(events))
	for _, event := range events {
		out = append(out, event.ResourceVersion)
	}
	return out
}

func TestWatchCacheCountCapEvictsFullestCollection(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	other := GroupResource{Group: "g", Resource: "other"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxEvents = 4
	cache.add(cacheEvent(quiet, 10))
	cache.add(cacheEvent(other, 11))
	for rv := int64(12); rv <= 20; rv++ {
		cache.add(cacheEvent(busy, rv))
		require.LessOrEqual(t, cache.count, cache.maxEvents)
	}
	require.Equal(t, cache.cachedLen(), cache.count)
	require.Equal(t, []int64{10}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{11}, replayRVs(t, &cache, other))
	require.Equal(t, []int64{19, 20}, replayRVs(t, &cache, busy))
	require.True(t, IsResourceVersionExpired(cache.validateResume(busy, watchResume{since: 17})))
	require.NoError(t, cache.validateResume(busy, watchResume{since: 18}))
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

func TestWatchCacheByteEvictionCountsIncomingEvent(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxBytes = 7 * 1024
	cache.add(sized(quiet, 10, 4*1024))
	cache.add(sized(busy, 11, 3*1024))
	// With the incoming event, busy holds the most bytes, so it makes the room.
	cache.add(sized(busy, 12, 3*1024))
	require.Equal(t, []int64{10}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{12}, replayRVs(t, &cache, busy))
	require.NoError(t, cache.validateResume(quiet, watchResume{since: 0}))
}

func TestWatchCacheByteEvictionBeforeCountEviction(t *testing.T) {
	small := GroupResource{Group: "g", Resource: "small"}
	large := GroupResource{Group: "g", Resource: "large"}
	incoming := GroupResource{Group: "g", Resource: "incoming"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxEvents = 3
	cache.maxBytes = 4096
	cache.add(sized(small, 10, 1))
	cache.add(sized(small, 11, 1))
	cache.add(sized(large, 12, 4094))
	// Making byte room also frees an event slot, so small keeps both events.
	cache.add(sized(incoming, 13, 1000))
	require.Equal(t, []int64{10, 11}, replayRVs(t, &cache, small))
	require.Equal(t, []int64{13}, replayRVs(t, &cache, incoming))
	require.NoError(t, cache.validateResume(small, watchResume{since: 0}))
}

func TestWatchCacheKeepsQuietCollectionWhenIncomingEventIsLargest(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxBytes = 8 * 1024
	cache.add(sized(quiet, 10, 3*1024))
	cache.add(sized(busy, 11, 1024))
	// Emptying busy's ring is not enough room, and the incoming event alone
	// still uses more bytes than quiet, so it stays uncached instead.
	cache.add(sized(busy, 12, 6*1024))
	require.Equal(t, []int64{10}, replayRVs(t, &cache, quiet))
	require.Equal(t, []int64{11}, replayRVs(t, &cache, busy))
	require.NoError(t, cache.validateResume(quiet, watchResume{since: 0}))
	require.True(t, IsResourceVersionExpired(cache.validateResume(busy, watchResume{since: 11})))
	require.NoError(t, cache.validateResume(busy, watchResume{since: 12}))
}

func TestWatchCacheRejectsBeforeEvictingOthers(t *testing.T) {
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	incoming := GroupResource{Group: "g", Resource: "incoming"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxBytes = 100
	cache.add(sized(first, 10, 4))
	cache.add(sized(first, 11, 50))
	cache.add(sized(second, 12, 46))
	// After evicting first's oldest, the incoming event would use the most bytes
	// and be left uncached, so nothing may be evicted for it.
	cache.add(sized(incoming, 13, 52))
	require.Equal(t, []int64{10, 11}, replayRVs(t, &cache, first))
	require.Equal(t, []int64{12}, replayRVs(t, &cache, second))
	require.Empty(t, replayRVs(t, &cache, incoming))
	require.NoError(t, cache.validateResume(first, watchResume{since: 0}))
	require.True(t, IsResourceVersionExpired(cache.validateResume(incoming, watchResume{since: 12})))
	require.NoError(t, cache.validateResume(incoming, watchResume{since: 13}))
}

func TestWatchCacheRejectionKeepsFullRing(t *testing.T) {
	late := GroupResource{Group: "g", Resource: "late"}
	other := GroupResource{Group: "g", Resource: "other"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(2, writtenEventIdentity)
	cache.maxBytes = 100
	cache.add(sized(late, 20, 1))
	cache.add(sized(late, 30, 1))
	cache.add(sized(other, 40, 60))
	// A late event too large to cache must not first evict from its full ring:
	// a cursor between the late RV and the oldest cached one still replays.
	cache.add(sized(late, 10, 80))
	require.Equal(t, []int64{20, 30}, replayRVs(t, &cache, late))
	require.NoError(t, cache.validateResume(late, watchResume{since: 15}))
	require.True(t, IsResourceVersionExpired(cache.validateResume(late, watchResume{since: 9})))
}

func BenchmarkWatchCacheRejectsOversizedEvent(b *testing.B) {
	own := GroupResource{Group: "g", Resource: "own"}
	cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	rv := int64(0)
	for range defaultCacheSize {
		rv++
		cache.add(sized(own, rv, 1))
	}
	for i := range 50 {
		rv++
		cache.add(sized(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 10))
	}
	cache.maxBytes = cache.sizeBytes
	// Larger than any other ring, and too large even once its own ring is empty.
	oversized := sized(own, rv+1, defaultCacheSize+100)
	for b.Loop() {
		cache.add(oversized)
	}
	if cache.cachedLen() != defaultCacheSize+50 {
		b.Fatal("a rejected event changed the cache")
	}
}

func TestWatchCacheLargeEventEvictsOnlyItsOwnCollection(t *testing.T) {
	own := GroupResource{Group: "g", Resource: "own"}
	other := GroupResource{Group: "g", Resource: "other"}
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	cache := newWatchCache(10, writtenEventIdentity)
	cache.maxBytes = 100
	for rv := int64(1); rv <= 4; rv++ {
		cache.add(sized(own, rv, 20))
	}
	cache.add(sized(other, 5, 20))
	// Larger than other's ring, so only own's oldest events make room for it.
	cache.add(sized(own, 6, 50))
	require.Equal(t, []int64{4, 6}, replayRVs(t, &cache, own))
	require.Equal(t, []int64{5}, replayRVs(t, &cache, other))
	require.Equal(t, int64(90), cache.sizeBytes)
	require.True(t, IsResourceVersionExpired(cache.validateResume(own, watchResume{since: 2})))
	require.NoError(t, cache.validateResume(own, watchResume{since: 3}))
}

func BenchmarkWatchCacheRejectsAfterPartialPlan(b *testing.B) {
	large := GroupResource{Group: "g", Resource: "large"}
	cache := newWatchCache(1000, writtenEventIdentity)
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	rv := int64(0)
	for range 1000 {
		rv++
		cache.add(sized(large, rv, 1))
	}
	for i := range 1000 {
		rv++
		cache.add(sized(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 1))
	}
	cache.maxBytes = cache.sizeBytes
	// Smaller than large's ring, so the plan walks it until the incoming event
	// is the largest consumer and gets rejected.
	incoming := sized(GroupResource{Group: "g", Resource: "incoming"}, rv+1, 600)
	for b.Loop() {
		cache.add(incoming)
	}
	if cache.cachedLen() != 2000 {
		b.Fatal("a rejected event changed the cache")
	}
}

// mostUsedRing scans every ring for the one using the most, counting the
// pending event in its own collection even once that collection's ring is
// gone. Ties go to other collections. It returns nil when the pending
// event's collection uses the most but holds nothing to evict.
func (c *watchCache[T]) mostUsedRing(gr GroupResource, usage func(*cacheRing[T]) int64, pending int64) *cacheRing[T] {
	most, mostUsage := c.rings[gr], pending
	if most != nil {
		if used := usage(most); used > 0 {
			mostUsage += used
		} else {
			most = nil
		}
	}
	for ringGR, ring := range c.rings {
		if used := usage(ring); ringGR != gr && used > 0 && used >= mostUsage {
			most, mostUsage = ring, used
		}
	}
	return most
}

// referencePlan is the straightforward planner: rescan every ring for each
// eviction. planEvictions must make the same decisions.
func (c *watchCache[T]) referencePlan(gr GroupResource, size int64) (map[*cacheRing[T]]int, bool) {
	evict := make(map[*cacheRing[T]]int)
	freed := make(map[*cacheRing[T]]int64)
	free := c.maxBytes - c.sizeBytes
	if own := c.rings[gr]; own != nil && own.len == own.limit {
		evict[own], freed[own] = 1, cacheItemSize(own.at(0))
		free += freed[own]
	}
	for size > free {
		ring := c.mostUsedRing(gr, func(r *cacheRing[T]) int64 { return r.sizeBytes - freed[r] }, size)
		if ring == nil {
			return nil, false
		}
		evicted := cacheItemSize(ring.at(evict[ring]))
		evict[ring]++
		freed[ring] += evicted
		free += evicted
	}
	return evict, true
}

func TestWatchCachePlanMatchesReference(t *testing.T) {
	rng := rand.New(rand.NewPCG(1, 2))
	var rejected, sharedEvictions int
	for trial := range 2000 {
		cache := newWatchCache(1+rng.IntN(3*ringInitialSize), writtenEventIdentity)
		cache.maxBytes = 1 << 40
		rv := int64(0)
		collections := 1 + rng.IntN(6)
		for range rng.IntN(40) {
			rv++
			event := cacheEvent(GroupResource{Group: "g", Resource: fmt.Sprint(rng.IntN(collections))}, rv)
			event.Value = make([]byte, rng.IntN(20))
			cache.add(event)
		}
		cache.maxBytes = cache.sizeBytes + int64(rng.IntN(10))
		gr := GroupResource{Group: "g", Resource: fmt.Sprint(rng.IntN(collections + 1))}
		size := int64(rng.IntN(int(cache.maxBytes) + 1))

		got, gotOK := cache.planEvictions(gr, size)
		want, wantOK := cache.referencePlan(gr, size)
		require.Equal(t, wantOK, gotOK, "trial %d", trial)
		if own := cache.rings[gr]; gotOK && own != nil {
			require.Equal(t, want[own], got[own], "trial %d: own evictions", trial)
		}
		if !gotOK {
			rejected++
		} else if len(got) > 1 {
			sharedEvictions++
		}
	}
	require.NotZero(t, rejected, "trials must cover rejected events")
	require.NotZero(t, sharedEvictions, "trials must cover evictions across collections")
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

func requireRankingsConsistent(t *testing.T, cache *watchCache[*WrittenEvent]) {
	t.Helper()
	var sizeBytes int64
	count := 0
	for _, ring := range cache.rings {
		sizeBytes += ring.sizeBytes
		count += ring.len
	}
	require.Equal(t, sizeBytes, cache.sizeBytes)
	require.Equal(t, count, cache.count)
	for _, ranking := range []*ringRanking[*WrittenEvent]{&cache.byBytes, &cache.byCount} {
		require.Len(t, ranking.rings, len(cache.rings))
		for i, ring := range ranking.rings {
			require.Equal(t, i, *ranking.index(ring))
			if i > 0 {
				require.GreaterOrEqual(t, ranking.used(ranking.rings[(i-1)/2]), ranking.used(ring), "heap order")
			}
		}
	}
}

func TestWatchCacheRankingsMatchScan(t *testing.T) {
	rng := rand.New(rand.NewPCG(3, 4))
	for trial := range 200 {
		cache := newWatchCache(1+rng.IntN(3*ringInitialSize), writtenEventIdentity)
		cache.maxBytes = int64(20 + rng.IntN(200))
		cache.maxEvents = 1 + rng.IntN(30)
		collections := 1 + rng.IntN(8)
		for rv := int64(1); rv <= 200; rv++ {
			gr := GroupResource{Group: "g", Resource: fmt.Sprint(rng.IntN(collections))}
			size := int64(rng.IntN(int(cache.maxBytes)/2 + 1))
			if own := cache.rings[gr]; (own == nil || own.len < own.limit) && size > cache.maxBytes-cache.sizeBytes {
				// The first byte eviction must match a scan of every ring.
				got := cache.largestRing(gr, size, 0)
				want := cache.mostUsedRing(gr, func(r *cacheRing[*WrittenEvent]) int64 { return r.sizeBytes }, size)
				require.Equal(t, want == nil, got == nil, "trial %d rv %d", trial, rv)
				if got != nil && got != want {
					require.Equal(t, want.sizeBytes, got.sizeBytes, "trial %d rv %d: only ties may differ", trial, rv)
				}
			}
			event := cacheEvent(gr, rv)
			event.Value = make([]byte, size)
			cache.add(event)
			requireRankingsConsistent(t, &cache)
			require.LessOrEqual(t, cache.sizeBytes, cache.maxBytes)
			require.LessOrEqual(t, cache.count, cache.maxEvents)
		}
	}
}

func requireNoPlanReferences(t *testing.T, cache *watchCache[*WrittenEvent]) {
	t.Helper()
	require.Empty(t, cache.planEvicted, "the plan must not keep rings alive")
	for _, candidate := range cache.planCandidates[:cap(cache.planCandidates)] {
		require.Nil(t, candidate.ring, "the scratch candidates must not keep rings alive")
	}
}

func TestWatchCachePlanBuffersReleaseRings(t *testing.T) {
	sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
		event := cacheEvent(gr, rv)
		event.Value = make([]byte, size)
		return event
	}
	first := GroupResource{Group: "g", Resource: "first"}
	second := GroupResource{Group: "g", Resource: "second"}
	third := GroupResource{Group: "g", Resource: "third"}

	t.Run("applied", func(t *testing.T) {
		cache := newWatchCache(10, writtenEventIdentity)
		cache.maxBytes = 100
		cache.add(sized(first, 1, 30))
		cache.add(sized(first, 2, 10))
		cache.add(sized(second, 3, 30))
		cache.add(sized(second, 4, 30))
		// Needs one eviction from second and one from first.
		cache.add(sized(third, 5, 40))
		require.Equal(t, []int64{5}, replayRVs(t, &cache, third))
		require.Equal(t, []int64{2}, replayRVs(t, &cache, first))
		require.Equal(t, []int64{4}, replayRVs(t, &cache, second))
		requireNoPlanReferences(t, &cache)
	})
	t.Run("rejected", func(t *testing.T) {
		cache := newWatchCache(10, writtenEventIdentity)
		cache.maxBytes = 100
		for rv := int64(1); rv <= 10; rv++ {
			cache.add(sized(first, rv, 5))
		}
		cache.add(sized(second, 11, 40))
		cache.add(sized(third, 12, 10))
		// After two of first's events, the incoming event uses the most bytes.
		incoming := GroupResource{Group: "g", Resource: "incoming"}
		cache.add(sized(incoming, 13, 45))
		require.Empty(t, replayRVs(t, &cache, incoming))
		require.Len(t, replayRVs(t, &cache, first), 10)
		requireNoPlanReferences(t, &cache)
	})
}

func BenchmarkWatchCacheMultiEvictionManyRings(b *testing.B) {
	for _, others := range []int{200, 4000} {
		b.Run(fmt.Sprint(others, "-rings"), func(b *testing.B) {
			own := GroupResource{Group: "g", Resource: "own"}
			cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
			cache.maxEvents = 10 * others
			sized := func(gr GroupResource, rv int64, size int) *WrittenEvent {
				event := cacheEvent(gr, rv)
				event.Value = make([]byte, size)
				return event
			}
			rv := int64(0)
			for i := range others {
				rv++
				cache.add(sized(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 10))
			}
			for range 100 {
				rv++
				cache.add(sized(own, rv, 100))
			}
			cache.maxBytes = cache.sizeBytes
			b.ReportAllocs()
			for b.Loop() {
				// Three of its own collection's events make room: more than one,
				// so it is planned, but no other collection is involved.
				plan, ok := cache.planEvictions(own, 300)
				if !ok || plan[cache.rings[own]] != 3 || len(plan) != 1 {
					b.Fatal("unexpected plan")
				}
				clear(cache.planEvicted)
			}
		})
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
