package state

import "sync/atomic"

// SeriesBudget caps how many series are tracked across many rules.
// A nil budget or a limit of 0 or less never refuses.
type SeriesBudget struct {
	limit int64
	used  atomic.Int64
}

func NewSeriesBudget(limit int64) *SeriesBudget {
	return &SeriesBudget{limit: limit}
}

// Admit reserves room for one series. It returns false when the budget is full.
func (b *SeriesBudget) Admit() bool {
	if b == nil {
		return true
	}
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

// Release gives back room for n series. It never takes the count below zero.
func (b *SeriesBudget) Release(n int) {
	if b == nil || n <= 0 {
		return
	}
	for {
		used := b.used.Load()
		next := max(used-int64(n), 0)
		if b.used.CompareAndSwap(used, next) {
			return
		}
	}
}

// Used is the number of series currently admitted.
func (b *SeriesBudget) Used() int64 {
	if b == nil {
		return 0
	}
	return b.used.Load()
}
