package resource

import (
	"container/heap"
	"fmt"
	"io"
	"sync"
)

type eventIdentity[T any] func(T) (GroupResource, int64)

type watchResume struct {
	since       int64
	requestedRV int64
	// unchecked resumes replay without a floor check. Negative cursors predate
	// resume floors and always replayed everything cached.
	unchecked bool
}

type cacheSeed[T any] struct {
	items             []T
	initialCacheFloor int64
	// collectionFloors override initialCacheFloor for per-collection RVs.
	collectionFloors map[GroupResource]int64
}

// watchCache is owned by the broadcaster's event loop so eviction and resume
// validation cannot race with replay and subscriber registration. Each
// collection has its own ring so a burst in one cannot evict another's events.
type watchCache[T any] struct {
	size             int
	rings            map[GroupResource]*cacheRing[T]
	initialFloor     int64
	collectionFloors map[GroupResource]int64
	evictedThrough   map[GroupResource]int64
	identity         eventIdentity[T]
	maxBytes         int64 // shared by all rings
	sizeBytes        int64
	// maxEvents bounds the per-event memory maxBytes does not count, however
	// many collections are written.
	maxEvents int
	count     int
	maxRV     int64
	raised    *raisedFloors

	// byBytes and byCount rank the rings for the shared limits, so those find
	// the collection to evict from without scanning every ring.
	byBytes, byCount ringRanking[T]
	// planCandidates and planEvictions are reused by planEvictions.
	planCandidates evictionHeap[T]
	planEvicted    map[*cacheRing[T]]int
}

type cacheRing[T any] struct {
	ringBuffer[T]
	sizeBytes              int64
	bytesIndex, countIndex int // positions in byBytes and byCount
}

// ringRanking is a max-heap of rings by one measure.
type ringRanking[T any] struct {
	rings []*cacheRing[T]
	used  func(*cacheRing[T]) int64
	index func(*cacheRing[T]) *int
}

func (r *ringRanking[T]) Len() int           { return len(r.rings) }
func (r *ringRanking[T]) Less(i, j int) bool { return r.used(r.rings[i]) > r.used(r.rings[j]) }
func (r *ringRanking[T]) Swap(i, j int) {
	r.rings[i], r.rings[j] = r.rings[j], r.rings[i]
	*r.index(r.rings[i]), *r.index(r.rings[j]) = i, j
}
func (r *ringRanking[T]) Push(x any) {
	ring := x.(*cacheRing[T])
	*r.index(ring) = len(r.rings)
	r.rings = append(r.rings, ring)
}
func (r *ringRanking[T]) Pop() any {
	last := r.rings[len(r.rings)-1]
	r.rings[len(r.rings)-1] = nil
	r.rings = r.rings[:len(r.rings)-1]
	return last
}

// topExcept returns the ring that uses the most other than skip, or nil.
func (r *ringRanking[T]) topExcept(skip *cacheRing[T]) *cacheRing[T] {
	if len(r.rings) == 0 {
		return nil
	}
	if r.rings[0] != skip {
		return r.rings[0]
	}
	// The root's children are the next largest.
	var top *cacheRing[T]
	for i := 1; i <= 2 && i < len(r.rings); i++ {
		if top == nil || r.used(r.rings[i]) > r.used(top) {
			top = r.rings[i]
		}
	}
	return top
}

// raisedFloors are resume floors raised after startup, for writes the
// stream lost. Unlike the cache they are updated from other goroutines.
type raisedFloors struct {
	mu     sync.Mutex
	floors map[GroupResource]int64
	// all applies to every collection, for backends whose RVs are global.
	all  int64
	held bool
}

func newRaisedFloors() *raisedFloors {
	return &raisedFloors{floors: make(map[GroupResource]int64)}
}

func (f *raisedFloors) Raise(gr GroupResource, rv int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.floors[gr] = max(f.floors[gr], rv)
}

// raiseAll rejects resumes from before rv in every collection.
func (f *raisedFloors) raiseAll(rv int64) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.all = max(f.all, rv)
}

func (f *raisedFloors) Hold() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = true
}

func (f *raisedFloors) Release() {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.held = false
}

// get returns the collection's raised floor, and whether every resume is held.
func (f *raisedFloors) get(gr GroupResource) (int64, bool) {
	if f == nil {
		return 0, false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return max(f.floors[gr], f.all), f.held
}

func newWatchCache[T any](size int, identity eventIdentity[T]) watchCache[T] {
	if size <= 0 {
		size = defaultCacheSize
	}
	return watchCache[T]{
		size:           size,
		rings:          make(map[GroupResource]*cacheRing[T]),
		evictedThrough: make(map[GroupResource]int64),
		identity:       identity,
		maxBytes:       defaultCacheMaxBytes,
		maxEvents:      defaultCacheMaxEvents,
		byBytes: ringRanking[T]{
			used:  func(ring *cacheRing[T]) int64 { return ring.sizeBytes },
			index: func(ring *cacheRing[T]) *int { return &ring.bytesIndex },
		},
		byCount: ringRanking[T]{
			used:  func(ring *cacheRing[T]) int64 { return int64(ring.len) },
			index: func(ring *cacheRing[T]) *int { return &ring.countIndex },
		},
		planEvicted: make(map[*cacheRing[T]]int),
	}
}

func (c *watchCache[T]) seed(seed cacheSeed[T]) error {
	if len(seed.items) > c.size {
		return fmt.Errorf("watch seed exceeds cache capacity")
	}
	c.initialFloor = seed.initialCacheFloor
	c.collectionFloors = seed.collectionFloors
	for _, item := range seed.items {
		c.add(item)
	}
	return nil
}

func cacheItemSize[T any](item T) int64 {
	if sized, ok := any(item).(interface{ sizeBytes() int64 }); ok {
		return sized.sizeBytes()
	}
	return 0
}

func (c *watchCache[T]) recordEviction(item T) {
	gr, rv := c.identity(item)
	c.evictedThrough[gr] = max(c.evictedThrough[gr], rv)
}

func (c *watchCache[T]) evictOldest(ring *cacheRing[T]) {
	evicted := ring.removeOldest()
	size := cacheItemSize(evicted)
	ring.sizeBytes -= size
	c.sizeBytes -= size
	c.count--
	c.recordEviction(evicted)
	if ring.len == 0 {
		gr, _ := c.identity(evicted)
		delete(c.rings, gr)
		heap.Remove(&c.byBytes, ring.bytesIndex)
		heap.Remove(&c.byCount, ring.countIndex)
		return
	}
	c.reranked(ring)
}

func (c *watchCache[T]) reranked(ring *cacheRing[T]) {
	heap.Fix(&c.byBytes, ring.bytesIndex)
	heap.Fix(&c.byCount, ring.countIndex)
}

// fullestRing returns the ring to evict from for the event count: the one
// holding the most events, counting the pending event in its own collection.
// Ties go to other collections.
func (c *watchCache[T]) fullestRing(gr GroupResource) *cacheRing[T] {
	own := c.rings[gr]
	other := c.byCount.topExcept(own)
	if own != nil && (other == nil || own.len+1 > other.len) {
		return own
	}
	return other
}

// largestRing returns the ring the byte limit evicts from first: the one
// using the most bytes, counting the pending event in its own collection.
// Ties go to other collections. It returns nil when the pending event's
// collection uses the most but has nothing left to evict. ownPlanned is the
// number of own events already planned for eviction.
func (c *watchCache[T]) largestRing(gr GroupResource, size int64, ownPlanned int) *cacheRing[T] {
	own := c.rings[gr]
	ownUsed := size
	if own != nil {
		ownUsed += own.sizeBytes
		for i := range ownPlanned {
			ownUsed -= cacheItemSize(own.at(i))
		}
	}
	if other := c.byBytes.topExcept(own); other != nil && other.sizeBytes > 0 && other.sizeBytes >= ownUsed {
		return other
	}
	if own != nil && own.len > ownPlanned && ownUsed > size {
		return own
	}
	return nil
}

// evictionCandidate is a collection that a byte eviction plan may evict from.
type evictionCandidate[T any] struct {
	ring *cacheRing[T] // nil for the incoming event's collection when it has no ring
	own  bool          // the incoming event's collection, whose used includes the event
	used int64
	next int // index of the oldest event not yet planned for eviction
	// rank is the ring's position in byBytes while no eviction is planned from
	// it yet, or -1. Taking such a candidate brings its children in, so the
	// plan only visits collections that compete for eviction.
	rank int
}

// evictionHeap orders candidates by the bytes they use, most first. Ties go
// to other collections, so the incoming event's collection only wins when it
// strictly uses the most.
type evictionHeap[T any] []evictionCandidate[T]

func (h evictionHeap[T]) Len() int { return len(h) }
func (h evictionHeap[T]) Less(i, j int) bool {
	return h[i].used > h[j].used || (h[i].used == h[j].used && h[j].own && !h[i].own)
}
func (h evictionHeap[T]) Swap(i, j int) { h[i], h[j] = h[j], h[i] }
func (h *evictionHeap[T]) Push(x any)   { *h = append(*h, x.(evictionCandidate[T])) }
func (h *evictionHeap[T]) Pop() any {
	old := *h
	last := old[len(old)-1]
	*h = old[:len(old)-1]
	return last
}

// planEvictions picks how many of each ring's oldest events to evict so an
// event of size fits its collection's ring and the shared byte budget, without
// evicting them yet. It reports false if the policy would leave the event
// uncached part way, so no collection loses history for it. The returned plan
// is reused by the next call.
func (c *watchCache[T]) planEvictions(gr GroupResource, size int64) (map[*cacheRing[T]]int, bool) {
	evict := c.planEvicted
	clear(evict)
	free := c.maxBytes - c.sizeBytes
	own := evictionCandidate[T]{ring: c.rings[gr], own: true, used: size, rank: -1}
	if own.ring != nil {
		own.used += own.ring.sizeBytes
		if own.ring.len == own.ring.limit {
			evicted := cacheItemSize(own.ring.at(0))
			evict[own.ring], own.next = 1, 1
			own.used -= evicted
			free += evicted
		}
	}
	if size <= free {
		return evict, true
	}
	// An event that outweighs every other ring only evicts from its own
	// collection, so whether it fits is known without walking that ring.
	var mostOther int64
	if other := c.byBytes.topExcept(own.ring); other != nil {
		mostOther = other.sizeBytes
	}
	if size > mostOther && size > free+own.used-size {
		return nil, false
	}

	ranked := c.byBytes.rings
	// Work on the cache's own buffer: a local slice would escape through the
	// heap interface and allocate on every plan.
	candidates := &c.planCandidates
	*candidates = append((*candidates)[:0], own)
	if len(ranked) > 0 {
		*candidates = append(*candidates, evictionCandidate[T]{ring: ranked[0], used: ranked[0].sizeBytes})
	}
	defer c.releaseCandidates()
	heap.Init(candidates)
	for size > free {
		top := (*candidates)[0]
		if top.own && top.used == size {
			// The event alone uses the most bytes and its collection has nothing left.
			return nil, false
		}
		if top.rank >= 0 {
			// Untouched ranks are never larger than their parent, so the
			// largest collection is always among the candidates.
			heap.Pop(candidates)
			for child := 2*top.rank + 1; child <= 2*top.rank+2 && child < len(ranked); child++ {
				heap.Push(candidates, evictionCandidate[T]{ring: ranked[child], used: ranked[child].sizeBytes, rank: child})
			}
			// The incoming event's own ring competes as the own candidate.
			if top.ring != own.ring {
				top.rank = -1
				heap.Push(candidates, top)
			}
			continue
		}
		evicted := cacheItemSize(top.ring.at(top.next))
		evict[top.ring]++
		(*candidates)[0].next++
		(*candidates)[0].used -= evicted
		free += evicted
		if !top.own && (*candidates)[0].used == 0 {
			heap.Pop(candidates)
		} else {
			heap.Fix(candidates, 0)
		}
	}
	return evict, true
}

// releaseCandidates keeps the candidates' buffer for the next plan. Popped
// entries stay in the backing array too, so every ring reference is dropped
// to not keep emptied rings alive.
func (c *watchCache[T]) releaseCandidates() {
	clear(c.planCandidates[:cap(c.planCandidates)])
	c.planCandidates = c.planCandidates[:0]
}

// add caches item and returns its collection. Shared limits evict from the
// collection using the most of them, so a burst in one collection cannot push
// out a quieter one's events.
func (c *watchCache[T]) add(item T) GroupResource {
	gr, rv := c.identity(item)
	// Max rather than last: a late out-of-order event must not move progress back.
	c.maxRV = max(c.maxRV, rv)
	size := cacheItemSize(item)
	if size > c.maxBytes {
		// An uncached event still advances the resume floor to prevent gaps.
		c.recordEviction(item)
		return gr
	}
	// Bytes first: evicting for bytes also frees event slots, so the count
	// limit may no longer need to evict from another collection.
	own := c.rings[gr]
	ownPlanned := 0
	free := c.maxBytes - c.sizeBytes
	if own != nil && own.len == own.limit {
		ownPlanned = 1
		free += cacheItemSize(own.at(0))
	}
	if size <= free {
		// Routine inserts need at most their own ring's oldest event evicted.
		if ownPlanned > 0 {
			c.evictOldest(own)
		}
	} else if victim := c.largestRing(gr, size, ownPlanned); victim != nil && size <= free+c.nextEvictedSize(victim, own, ownPlanned) {
		// Once the budget is full, one eviction usually makes room.
		if ownPlanned > 0 {
			c.evictOldest(own)
		}
		c.evictOldest(victim)
	} else {
		plan, ok := c.planEvictions(gr, size)
		for ring, events := range plan {
			for range events {
				c.evictOldest(ring)
			}
		}
		// The plan's map is reused; drop its keys so emptied rings are not kept alive.
		clear(c.planEvicted)
		if !ok {
			// Leave the event uncached rather than evict a quieter collection.
			c.recordEviction(item)
			return gr
		}
	}
	for c.count >= c.maxEvents {
		c.evictOldest(c.fullestRing(gr))
	}
	// Look the ring up after evicting: making room can empty and drop it.
	ring, ok := c.rings[gr]
	if !ok {
		ring = &cacheRing[T]{ringBuffer: newRingBuffer[T](c.size)}
		c.rings[gr] = ring
		heap.Push(&c.byBytes, ring)
		heap.Push(&c.byCount, ring)
	}
	ring.add(item)
	ring.sizeBytes += size
	c.sizeBytes += size
	c.count++
	c.reranked(ring)
	return gr
}

// nextEvictedSize returns the size of the next event the byte limit would
// evict from victim, after own's planned evictions.
func (c *watchCache[T]) nextEvictedSize(victim, own *cacheRing[T], ownPlanned int) int64 {
	next := 0
	if victim == own {
		next = ownPlanned
	}
	return cacheItemSize(victim.at(next))
}

func (c *watchCache[T]) validateResume(gr GroupResource, resume watchResume) error {
	floor, ok := c.collectionFloors[gr]
	if !ok {
		floor = c.initialFloor
	}
	raised, held := c.raised.get(gr)
	floor = max(floor, c.evictedThrough[gr], raised)
	if held || resume.since < floor {
		return NewResourceVersionExpiredError(resume.requestedRV)
	}
	return nil
}

// replay sends gr's cached events.
func (c *watchCache[T]) replay(dst chan<- T, gr GroupResource) error {
	if ring, ok := c.rings[gr]; ok && !ring.readInto(dst) {
		return io.ErrShortBuffer
	}
	return nil
}

// ringBuffer is a circular buffer of up to limit items. It starts small and
// grows as items arrive, so a collection with few events does not reserve
// every slot. It is not safe for concurrent use — the broadcaster's single
// stream() goroutine is the only caller.
type ringBuffer[T any] struct {
	buf   []T
	zero  int // index of the oldest item
	len   int // number of items currently stored
	limit int
}

// ringInitialSize is how many slots a ring starts with.
const ringInitialSize = 8

func newRingBuffer[T any](limit int) ringBuffer[T] {
	if limit <= 0 {
		limit = defaultCacheSize
	}
	return ringBuffer[T]{
		buf:   make([]T, min(limit, ringInitialSize)),
		limit: limit,
	}
}

func (r *ringBuffer[T]) grow() {
	buf := make([]T, min(2*len(r.buf), r.limit))
	for i := range r.len {
		buf[i] = r.at(i)
	}
	r.buf, r.zero = buf, 0
}

func (r *ringBuffer[T]) add(item T) (evicted T, ok bool) {
	if r.len == len(r.buf) && len(r.buf) < r.limit {
		r.grow()
	}
	i := (r.zero + r.len) % len(r.buf)
	if r.len == len(r.buf) {
		evicted, ok = r.buf[i], true
	}
	r.buf[i] = item
	if r.len < len(r.buf) {
		r.len++
	} else {
		r.zero = (r.zero + 1) % len(r.buf)
	}
	return evicted, ok
}

func (r *ringBuffer[T]) removeOldest() T {
	item := r.buf[r.zero]
	var zero T
	r.buf[r.zero] = zero
	r.zero = (r.zero + 1) % len(r.buf)
	r.len--
	return item
}

// at returns the i-th oldest item.
func (r *ringBuffer[T]) at(i int) T {
	return r.buf[(r.zero+i)%len(r.buf)]
}

// readInto sends all cached items to dst without blocking. Returns true if all
// items were sent, false if dst's buffer was full (slow consumer).
func (r *ringBuffer[T]) readInto(dst chan<- T) bool {
	for i := 0; i < r.len; i++ {
		select {
		case dst <- r.buf[(r.zero+i)%len(r.buf)]:
		default:
			return false
		}
	}
	return true
}
