package search

import (
	"cmp"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/blevesearch/bleve/v2/index/scorch"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const (
	bleveMergeLogMessage    = "Expensive Bleve disk merges"
	bleveMergeLogMinElapsed = time.Second
	bleveMergeLogWindow     = time.Minute
	bleveMergeLogLimit      = 3
)

var processBleveMergeLogLimiter bleveMergeLogLimiter

type bleveMergeLogLimiter struct {
	mu     sync.Mutex
	logged [bleveMergeLogLimit]time.Time
	next   int
}

func (l *bleveMergeLogLimiter) log(logger log.Logger, fields []any) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	if oldest := l.logged[l.next]; !oldest.IsZero() && time.Since(oldest) < bleveMergeLogWindow {
		return false
	}
	logger.Info(bleveMergeLogMessage, fields...)
	l.logged[l.next] = time.Now()
	l.next = (l.next + 1) % len(l.logged)
	return true
}

type bleveMergeCounters struct {
	elapsed uint64
	calls   uint64
}

// A sampler belongs to one background worker. The log limit is shared across backends.
type bleveMergeSampler struct {
	limiter *bleveMergeLogLimiter
	last    map[*scorch.Stats]bleveMergeCounters
	lastAt  time.Time
}

type bleveDiskMergeStats struct {
	key   resource.NamespacedResource
	stats *scorch.Stats
}

// Disk indexes accumulate segments as documents are written. Read Bleve's own
// counters to identify which indexes spent time combining those segments, without
// adding work to the merge itself.
func (s *bleveMergeSampler) sample(b *bleveBackend, minElapsed time.Duration) {
	b.cacheMx.RLock()
	var indexes []*bleveIndex
	for _, idx := range b.cache {
		if idx.indexStorage == indexStorageFile {
			indexes = append(indexes, idx)
		}
	}
	b.cacheMx.RUnlock()

	indexStats := make([]bleveDiskMergeStats, 0, len(indexes))
	for _, idx := range indexes {
		inner, err := idx.index.Advanced()
		if err != nil {
			continue
		}
		disk, ok := inner.(*scorch.Scorch)
		if !ok {
			continue
		}
		// StatsMap scans the index directory. Raw counters are safe to read even
		// if this instance closes after we copy it from the cache.
		if stats, ok := disk.Stats().(*scorch.Stats); ok {
			indexStats = append(indexStats, bleveDiskMergeStats{key: idx.key, stats: stats})
		}
	}
	s.logSample(b.log, indexStats, minElapsed)
}

func (s *bleveMergeSampler) logSample(logger log.Logger, indexes []bleveDiskMergeStats, minElapsed time.Duration) {
	sampledAt := time.Now()
	type candidate struct {
		key resource.NamespacedResource
		bleveMergeCounters
		firstSample bool
	}
	var candidates []candidate
	current := make(map[*scorch.Stats]bleveMergeCounters, len(indexes))
	for _, idx := range indexes {
		stats := idx.stats
		// The two atomics are updated separately, so a merge finishing during
		// this read may contribute to the count and elapsed time in different samples.
		counters := bleveMergeCounters{
			elapsed: atomic.LoadUint64(&stats.TotFileMergeZapTime),
			calls:   atomic.LoadUint64(&stats.TotFileMergeZapEnd),
		}
		previous, seen := s.last[stats]
		current[stats] = counters
		elapsed := counters.elapsed - previous.elapsed
		if elapsed >= uint64(minElapsed) {
			candidates = append(candidates, candidate{
				key:                idx.key,
				bleveMergeCounters: bleveMergeCounters{elapsed: elapsed, calls: counters.calls - previous.calls},
				firstSample:        !seen,
			})
		}
	}
	// Keep only open instances, and don't replay work suppressed by the log limit.
	window := sampledAt.Sub(s.lastAt)
	s.last, s.lastAt = current, sampledAt

	slices.SortFunc(candidates, func(a, b candidate) int { return cmp.Compare(b.elapsed, a.elapsed) })
	for _, entry := range candidates {
		fields := []any{
			"namespace", entry.key.Namespace, "group", entry.key.Group, "resource", entry.key.Resource,
			"merge_elapsed_ms", float64(entry.elapsed) / float64(time.Millisecond), "merge_calls", entry.calls,
		}
		if !entry.firstSample {
			fields = append(fields, "sample_window_ms", window.Milliseconds())
		}
		if !s.limiter.log(logger, fields) {
			break
		}
	}
}
