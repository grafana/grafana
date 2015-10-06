package metrics

import "sync/atomic"

// Counters hold an int64 value that can be incremented and decremented.
type Counter interface {
	Clear()
	Count() int64
	Dec(int64)
	Inc(int64)
	Snapshot() Counter
}

// NewCounter constructs a new StandardCounter.
func NewCounter() Counter {
	return &StandardCounter{0}
}

// CounterSnapshot is a read-only copy of another Counter.
type CounterSnapshot int64

// Clear panics.
func (CounterSnapshot) Clear() {
	panic("Clear called on a CounterSnapshot")
}

// Count returns the count at the time the snapshot was taken.
func (c CounterSnapshot) Count() int64 { return int64(c) }

// Dec panics.
func (CounterSnapshot) Dec(int64) {
	panic("Dec called on a CounterSnapshot")
}

// Inc panics.
func (CounterSnapshot) Inc(int64) {
	panic("Inc called on a CounterSnapshot")
}

// Snapshot returns the snapshot.
func (c CounterSnapshot) Snapshot() Counter { return c }

// StandardCounter is the standard implementation of a Counter and uses the
// sync/atomic package to manage a single int64 value.
type StandardCounter struct {
	count int64
}

// Clear sets the counter to zero.
func (c *StandardCounter) Clear() {
	atomic.StoreInt64(&c.count, 0)
}

// Count returns the current count.
func (c *StandardCounter) Count() int64 {
	return atomic.LoadInt64(&c.count)
}

// Dec decrements the counter by the given amount.
func (c *StandardCounter) Dec(i int64) {
	atomic.AddInt64(&c.count, -i)
}

// Inc increments the counter by the given amount.
func (c *StandardCounter) Inc(i int64) {
	atomic.AddInt64(&c.count, i)
}

// Snapshot returns a read-only copy of the counter.
func (c *StandardCounter) Snapshot() Counter {
	return CounterSnapshot(c.Count())
}
