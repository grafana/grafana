package router

import (
	"sync/atomic"
	"time"
)

// durationBuckets are the upper bounds, in seconds, of durationStats's buckets.
var durationBuckets = [...]float64{0.005, 0.025, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30}

// durationStats is a histogram of durations that something reports when it is
// scraped (see routerCollector), so the code that measures them needs no
// registry. Safe for concurrent use.
type durationStats struct {
	counts [len(durationBuckets) + 1]atomic.Uint64 // per bucket, not cumulative; the last is +Inf
	sumNs  atomic.Int64
}

func (s *durationStats) observe(d time.Duration) {
	i := 0
	for i < len(durationBuckets) && d.Seconds() > durationBuckets[i] {
		i++
	}
	s.counts[i].Add(1)
	s.sumNs.Add(int64(d))
}

// durationSnapshot is a durationStats read for a scrape: cumulative bucket
// counts keyed by upper bound, as prometheus.MustNewConstHistogram takes them.
type durationSnapshot struct {
	count   uint64
	sum     float64
	buckets map[float64]uint64
}

func (s *durationStats) snapshot() durationSnapshot {
	snap := durationSnapshot{sum: time.Duration(s.sumNs.Load()).Seconds(), buckets: make(map[float64]uint64, len(durationBuckets))}
	for i := range s.counts {
		snap.count += s.counts[i].Load()
		if i < len(durationBuckets) {
			snap.buckets[durationBuckets[i]] = snap.count
		}
	}
	return snap
}
