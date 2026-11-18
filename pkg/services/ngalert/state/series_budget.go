package state

import "sync/atomic"

// SeriesBudget caps how many series are tracked across many rules.
// A nil budget or a limit of 0 or less never refuses.
type SeriesBudget struct {
	limit  int64
	used   atomic.Int64
	parent *SeriesBudget
}

func NewSeriesBudget(limit int64) *SeriesBudget {
	return &SeriesBudget{limit: limit}
}

// Child returns a budget with its own limit that also counts against b.
// A series is admitted only if both have room, and a limit of 0 or less leaves only b's limit.
func (b *SeriesBudget) Child(limit int64) *SeriesBudget {
	return &SeriesBudget{limit: limit, parent: b}
}

// Admit reserves room for one series. It returns false when the budget, or its parent, is full.
func (b *SeriesBudget) Admit() bool {
	if b == nil {
		return true
	}
	if !b.reserve() {
		return false
	}
	if b.parent != nil && !b.parent.Admit() {
		b.give(1)
		return false
	}
	return true
}

// Release gives back room for n series. It never takes the count below zero.
func (b *SeriesBudget) Release(n int) {
	if b == nil || n <= 0 {
		return
	}
	// Only what this budget really held goes back to the parent, or an over-release
	// here would take room the parent gave to someone else.
	b.parent.Release(int(b.give(int64(n))))
}

func (b *SeriesBudget) reserve() bool {
	if b.limit <= 0 {
		b.used.Add(1)
		return true
	}
	for {
		used := b.used.Load()
		if used >= b.limit {
			return false
		}
		if b.used.CompareAndSwap(used, used+1) {
			return true
		}
	}
}

// give lowers the count by up to n and returns by how much.
func (b *SeriesBudget) give(n int64) int64 {
	for {
		used := b.used.Load()
		next := max(used-n, 0)
		if b.used.CompareAndSwap(used, next) {
			return used - next
		}
	}
}

// Used is the number of series admitted through this budget, including its children's.
func (b *SeriesBudget) Used() int64 {
	if b == nil {
		return 0
	}
	return b.used.Load()
}
