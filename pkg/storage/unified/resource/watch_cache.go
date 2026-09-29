package resource

import (
	"fmt"
	"io"
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
}

// watchCache is owned by the broadcaster's event loop so eviction and resume
// validation cannot race with replay and subscriber registration.
type watchCache[T any] struct {
	events         ringBuffer[T]
	initialFloor   int64
	evictedThrough map[GroupResource]int64
	identity       eventIdentity[T]
}

func newWatchCache[T any](size int, identity eventIdentity[T]) watchCache[T] {
	return watchCache[T]{
		events:         newRingBuffer[T](size),
		evictedThrough: make(map[GroupResource]int64),
		identity:       identity,
	}
}

func (c *watchCache[T]) seed(seed cacheSeed[T]) error {
	if len(seed.items) > len(c.events.buf) {
		return fmt.Errorf("watch seed exceeds cache capacity")
	}
	c.initialFloor = seed.initialCacheFloor
	for _, item := range seed.items {
		c.events.add(item)
	}
	return nil
}

func (c *watchCache[T]) add(item T) {
	evicted, ok := c.events.add(item)
	if ok && c.identity != nil {
		gr, rv := c.identity(evicted)
		c.evictedThrough[gr] = rv
	}
}

func (c *watchCache[T]) validateResume(resume watchResume) error {
	if c.identity == nil {
		return fmt.Errorf("checked resume requires a seeded watch cache")
	}
	floor, ok := c.evictedThrough[resume.groupResource]
	if !ok {
		floor = c.initialFloor
	}
	if resume.since < floor {
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
