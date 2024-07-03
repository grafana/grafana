package resource

import "sync/atomic"

// The kubernetes storage.Interface tests expect this to be a sequential progression
// SnowflakeIDs do not pass the off-the-shelf k8s tests, although they provide totally
// acceptable values.
type NextResourceVersion = func() int64

func newResourceVersionCounter(start int64) NextResourceVersion {
	var counter atomic.Int64
	_ = counter.Swap(start + 1)
	return func() int64 {
		return counter.Add(1)
	}
}
