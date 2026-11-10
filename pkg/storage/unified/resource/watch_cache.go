package resource

import (
	"fmt"
	"io"
	"sync"
)

type eventIdentity[T any] func(T) (GroupResource, int64)

type watchResume struct {
	groupResource GroupResource
	since         int64
	requestedRV   int64
}

type cacheSeed[T any] struct {
	items             []T
	initialCacheFloor int64
	// collectionFloors override initialCacheFloor for per-collection RVs.
	collectionFloors map[GroupResource]int64
}

// watchCache is owned by the broadcaster's event loop so eviction and resume
// validation cannot race with replay and subscriber registration.
type watchCache[T any] struct {
	events           ringBuffer[T]
	initialFloor     int64
	collectionFloors map[GroupResource]int64
	evictedThrough   map[GroupResource]int64
	identity         eventIdentity[T]
	maxBytes         int64
	sizeBytes        int64
	raised           *raisedFloors
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
	return watchCache[T]{
		events:         newRingBuffer[T](size),
		evictedThrough: make(map[GroupResource]int64),
		identity:       identity,
		maxBytes:       defaultCacheMaxBytes,
	}
}

func (c *watchCache[T]) seed(seed cacheSeed[T]) error {
	if len(seed.items) > len(c.events.buf) {
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
	if c.identity != nil {
		gr, rv := c.identity(item)
		c.evictedThrough[gr] = max(c.evictedThrough[gr], rv)
	}
}

func (c *watchCache[T]) add(item T) {
	size := cacheItemSize(item)
	for c.events.len > 0 && (c.events.len == len(c.events.buf) || size > c.maxBytes-c.sizeBytes) {
		evicted := c.events.removeOldest()
		c.sizeBytes -= cacheItemSize(evicted)
		c.recordEviction(evicted)
	}
	if size > c.maxBytes {
		// An uncached event still advances the resume floor to prevent gaps.
		c.recordEviction(item)
		return
	}
	c.events.add(item)
	c.sizeBytes += size
}

func (c *watchCache[T]) validateResume(resume watchResume) error {
	if c.identity == nil {
		return fmt.Errorf("checked resume requires a seeded watch cache")
	}
	floor, ok := c.collectionFloors[resume.groupResource]
	if !ok {
		floor = c.initialFloor
	}
	raised, held := c.raised.get(resume.groupResource)
	floor = max(floor, c.evictedThrough[resume.groupResource], raised)
	if held || resume.since < floor {
		return NewResourceVersionExpiredError(resume.requestedRV)
	}
	return nil
}

func (c *watchCache[T]) replay(dst chan<- T) error {
	if !c.events.readInto(dst) {
		return io.ErrShortBuffer
	}
	return nil
}

// ringBuffer is a fixed-size circular buffer. It is not safe for concurrent
// use — the broadcaster's single stream() goroutine is the only caller.
type ringBuffer[T any] struct {
	buf  []T
	zero int // index of the oldest item
	len  int // number of items currently stored
}

func newRingBuffer[T any](size int) ringBuffer[T] {
	if size <= 0 {
		size = defaultCacheSize
	}
	return ringBuffer[T]{
		buf: make([]T, size),
	}
}

func (r *ringBuffer[T]) add(item T) (evicted T, ok bool) {
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
