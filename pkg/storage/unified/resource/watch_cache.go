package resource

import (
	"fmt"
	"io"
	"sync"
)

type eventIdentity[T any] func(T) (GroupResource, int64)

type watchResume struct {
	since       int64
	requestedRV int64
}

type cacheSeed[T any] struct {
	items             []T
	initialCacheFloor int64
	// collectionFloors override initialCacheFloor for per-collection RVs.
	collectionFloors map[GroupResource]int64
}

// watchCache is owned by the broadcaster's event loop. The rings cap replay
// history per collection, while a shared FIFO bounds total memory.
type watchCache[T any] struct {
	size             int
	rings            map[GroupResource]*ringBuffer[*cacheEntry[T]]
	initialFloor     int64
	collectionFloors map[GroupResource]int64
	evictedThrough   map[GroupResource]int64
	identity         eventIdentity[T]
	maxBytes         int64
	sizeBytes        int64
	maxEvents        int // bounds memory outside event payloads
	count            int
	maxRV            int64
	raised           *raisedFloors
	oldest, newest   *cacheEntry[T]
}

// A ring points to its entries in the shared FIFO so it can evict its own
// oldest entry in constant time, even if that entry is in the middle.
type cacheEntry[T any] struct {
	item       T
	prev, next *cacheEntry[T]
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
		rings:          make(map[GroupResource]*ringBuffer[*cacheEntry[T]]),
		evictedThrough: make(map[GroupResource]int64),
		identity:       identity,
		maxBytes:       defaultCacheMaxBytes,
		maxEvents:      defaultCacheMaxEvents,
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

func (c *watchCache[T]) add(item T) GroupResource {
	gr, rv := c.identity(item)
	c.maxRV = max(c.maxRV, rv)
	size := cacheItemSize(item)
	if size > c.maxBytes {
		// Live delivery continues, but a resume that needs this event must relist.
		c.evictedThrough[gr] = max(c.evictedThrough[gr], rv)
		return gr
	}

	var entry *cacheEntry[T]
	if ring := c.rings[gr]; ring != nil && ring.len == c.size {
		entry = ring.at(0)
		c.evict(entry)
	}
	for c.count >= c.maxEvents || size > c.maxBytes-c.sizeBytes {
		entry = c.oldest
		c.evict(entry)
	}

	// Reuse an evicted entry when rotating a full ring or cache.
	if entry == nil {
		entry = &cacheEntry[T]{}
	}
	*entry = cacheEntry[T]{item: item, prev: c.newest}
	if c.newest == nil {
		c.oldest = entry
	} else {
		c.newest.next = entry
	}
	c.newest = entry

	ring := c.rings[gr]
	if ring == nil {
		buffer := newRingBuffer[*cacheEntry[T]](c.size)
		ring = &buffer
		c.rings[gr] = ring
	}
	ring.add(entry)
	c.sizeBytes += size
	c.count++
	return gr
}

// evict removes the oldest entry in its collection and unlinks it from the
// shared FIFO. The shared oldest entry is also the oldest in its collection.
func (c *watchCache[T]) evict(entry *cacheEntry[T]) {
	gr, rv := c.identity(entry.item)
	ring := c.rings[gr]
	ring.removeOldest()
	if ring.len == 0 {
		delete(c.rings, gr)
	}
	c.sizeBytes -= cacheItemSize(entry.item)
	c.count--
	c.evictedThrough[gr] = max(c.evictedThrough[gr], rv)

	if entry.prev == nil {
		c.oldest = entry.next
	} else {
		entry.prev.next = entry.next
	}
	if entry.next == nil {
		c.newest = entry.prev
	} else {
		entry.next.prev = entry.prev
	}
}

func cacheItemSize[T any](item T) int64 {
	if sized, ok := any(item).(interface{ sizeBytes() int64 }); ok {
		return sized.sizeBytes()
	}
	return 0
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
	ring := c.rings[gr]
	if ring == nil {
		return nil
	}
	for i := range ring.len {
		select {
		case dst <- ring.at(i).item:
		default:
			return io.ErrShortBuffer
		}
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
