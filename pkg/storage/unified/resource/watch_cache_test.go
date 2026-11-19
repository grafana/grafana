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

func TestWatchCacheByteEviction(t *testing.T) {
	quiet := GroupResource{Group: "g", Resource: "quiet"}
	busy := GroupResource{Group: "g", Resource: "busy"}
	incoming := GroupResource{Group: "g", Resource: "incoming"}
	type write struct {
		gr   GroupResource
		rv   int64
		size int
	}
	type replay struct {
		gr    GroupResource
		floor int64
		rvs   []int64
	}
	for _, tc := range []struct {
		name       string
		maxBytes   int64
		maxEvents  int
		ringLimit  int
		seedFloors map[GroupResource]int64
		writes     []write
		want       []replay
	}{
		{
			name: "burst evicts the largest collection", maxBytes: 4,
			writes: []write{{quiet, 10, 1}, {busy, 11, 1}, {busy, 12, 1}, {busy, 13, 1}, {busy, 14, 1}},
			want:   []replay{{quiet, 0, []int64{10}}, {busy, 11, []int64{12, 13, 14}}},
		},
		{
			name: "pending bytes count toward the largest collection", maxBytes: 7,
			seedFloors: map[GroupResource]int64{busy: 10},
			writes:     []write{{quiet, 10, 4}, {busy, 11, 3}, {busy, 12, 3}},
			want:       []replay{{quiet, 0, []int64{10}}, {busy, 11, []int64{12}}},
		},
		{
			name: "byte eviction also frees a count slot", maxBytes: 100, maxEvents: 3,
			writes: []write{{quiet, 10, 1}, {quiet, 11, 1}, {busy, 12, 98}, {incoming, 13, 25}},
			want:   []replay{{quiet, 0, []int64{10, 11}}, {busy, 12, nil}, {incoming, 0, []int64{13}}},
		},
		{
			name: "reject when the incoming event alone outweighs other rings", maxBytes: 8,
			writes: []write{{quiet, 10, 3}, {busy, 11, 1}, {busy, 12, 6}},
			want:   []replay{{quiet, 0, []int64{10}}, {busy, 12, []int64{11}}},
		},
		{
			name: "reject without applying a partial plan", maxBytes: 100,
			writes: []write{{busy, 10, 4}, {busy, 11, 50}, {quiet, 12, 46}, {incoming, 13, 52}},
			want:   []replay{{busy, 0, []int64{10, 11}}, {quiet, 0, []int64{12}}, {incoming, 13, nil}},
		},
		{
			name: "reject a late event without evicting from its full ring", maxBytes: 100, ringLimit: 2,
			writes: []write{{busy, 20, 1}, {busy, 30, 1}, {quiet, 40, 60}, {busy, 10, 80}},
			want:   []replay{{busy, 10, []int64{20, 30}}, {quiet, 0, []int64{40}}},
		},
		{
			name: "evict several events from the incoming collection", maxBytes: 100,
			writes: []write{{busy, 1, 20}, {busy, 2, 20}, {busy, 3, 20}, {busy, 4, 20}, {quiet, 5, 20}, {busy, 6, 50}},
			want:   []replay{{busy, 3, []int64{4, 6}}, {quiet, 0, []int64{5}}},
		},
		{
			name: "evict from multiple collections", maxBytes: 100,
			writes: []write{{quiet, 1, 30}, {quiet, 2, 10}, {busy, 3, 30}, {busy, 4, 30}, {incoming, 5, 40}},
			want:   []replay{{quiet, 1, []int64{2}}, {busy, 3, []int64{4}}, {incoming, 0, []int64{5}}},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cache := newWatchCache(tc.ringLimit, writtenEventIdentity)
			cache.maxBytes = tc.maxBytes
			if tc.maxEvents > 0 {
				cache.maxEvents = tc.maxEvents
			}
			require.NoError(t, cache.seed(cacheSeed[*WrittenEvent]{collectionFloors: tc.seedFloors}))
			for _, event := range tc.writes {
				cache.add(sizedCacheEvent(event.gr, event.rv, event.size))
				require.LessOrEqual(t, cache.sizeBytes, cache.maxBytes)
				require.LessOrEqual(t, cache.count, cache.maxEvents)
			}
			for _, want := range tc.want {
				require.Equal(t, want.rvs, replayRVs(t, &cache, want.gr), want.gr.Resource)
				require.NoError(t, cache.validateResume(want.gr, watchResume{since: want.floor}), want.gr.Resource)
				require.True(t, IsResourceVersionExpired(cache.validateResume(want.gr, watchResume{since: want.floor - 1})), want.gr.Resource)
			}
			requireRankingsConsistent(t, &cache)
			requireNoPlanReferences(t, &cache)
		})
	}
}

func sizedCacheEvent(gr GroupResource, rv int64, size int) *WrittenEvent {
	event := cacheEvent(gr, rv)
	event.Value = make([]byte, size)
	return event
}

func replayRVs(t *testing.T, cache *watchCache[*WrittenEvent], gr GroupResource) []int64 {
	t.Helper()
	replayed := make(chan *WrittenEvent, cache.size)
	require.NoError(t, cache.replay(replayed, gr))
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

func BenchmarkWatchCacheRejectsOversizedEvent(b *testing.B) {
	own := GroupResource{Group: "g", Resource: "own"}
	cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
	rv := int64(0)
	for range defaultCacheSize {
		rv++
		cache.add(sizedCacheEvent(own, rv, 1))
	}
	for i := range 50 {
		rv++
		cache.add(sizedCacheEvent(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 10))
	}
	cache.maxBytes = cache.sizeBytes
	// Larger than any other ring, and too large even once its own ring is empty.
	oversized := sizedCacheEvent(own, rv+1, defaultCacheSize+100)
	for b.Loop() {
		cache.add(oversized)
	}
	if cache.cachedLen() != defaultCacheSize+50 {
		b.Fatal("a rejected event changed the cache")
	}
}

func BenchmarkWatchCacheRejectsAfterPartialPlan(b *testing.B) {
	large := GroupResource{Group: "g", Resource: "large"}
	cache := newWatchCache(1000, writtenEventIdentity)
	rv := int64(0)
	for range 1000 {
		rv++
		cache.add(sizedCacheEvent(large, rv, 1))
	}
	for i := range 1000 {
		rv++
		cache.add(sizedCacheEvent(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 1))
	}
	cache.maxBytes = cache.sizeBytes
	// Smaller than large's ring, so the plan walks it until the incoming event
	// is the largest consumer and gets rejected.
	incoming := sizedCacheEvent(GroupResource{Group: "g", Resource: "incoming"}, rv+1, 600)
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

func BenchmarkWatchCacheMultiEvictionManyRings(b *testing.B) {
	for _, others := range []int{200, 4000} {
		b.Run(fmt.Sprint(others, "-rings"), func(b *testing.B) {
			own := GroupResource{Group: "g", Resource: "own"}
			cache := newWatchCache(defaultCacheSize, writtenEventIdentity)
			cache.maxEvents = 10 * others
			rv := int64(0)
			for i := range others {
				rv++
				cache.add(sizedCacheEvent(GroupResource{Group: "g", Resource: fmt.Sprint("other-", i)}, rv, 10))
			}
			for range 100 {
				rv++
				cache.add(sizedCacheEvent(own, rv, 100))
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
