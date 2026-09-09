package git

import (
	"context"
	"sync/atomic"
)

type clientStatsKey struct{}

// ClientStats accumulates the nanogit client events observed while work runs on
// the context it is attached to: HTTP round trips to the Git server (and how
// many of those were retries), objects and bytes fetched over the network, and
// packfile cache hits and misses.
//
// Where the ClientMetrics counters answer "how much git traffic is the fleet
// doing", ClientStats answers "how much did this scope of work take" — the total
// round trips, retries and cache misses behind whatever ran on the context —
// which a fleet-wide counter cannot attribute back to a single scope.
//
// A ClientStats is populated by the repository's client recorder as nanogit
// operates on the context, so no call site records into it directly. Its methods
// are safe for concurrent use.
type ClientStats struct {
	httpRequests   atomic.Int64
	httpRetries    atomic.Int64
	objectsFetched atomic.Int64
	bytesFetched   atomic.Int64
	cacheHits      atomic.Int64
	cacheMisses    atomic.Int64
}

// ClientStatsSnapshot is a point-in-time read of a ClientStats.
type ClientStatsSnapshot struct {
	HTTPRequests   int64
	HTTPRetries    int64
	ObjectsFetched int64
	BytesFetched   int64
	CacheHits      int64
	CacheMisses    int64
}

// WithClientStats returns a context that accumulates client stats into the
// returned ClientStats, plus that ClientStats to read once the work on the
// context is done. Stats are collected only while the repository's client
// recorder is installed (i.e. metrics are registered); without it the returned
// stats stay zero, which is harmless.
func WithClientStats(ctx context.Context) (context.Context, *ClientStats) {
	stats := &ClientStats{}
	return context.WithValue(ctx, clientStatsKey{}, stats), stats
}

func clientStatsFromContext(ctx context.Context) *ClientStats {
	stats, _ := ctx.Value(clientStatsKey{}).(*ClientStats)
	return stats
}

// Snapshot reads the current totals. Safe to call concurrently with recording.
func (s *ClientStats) Snapshot() ClientStatsSnapshot {
	return ClientStatsSnapshot{
		HTTPRequests:   s.httpRequests.Load(),
		HTTPRetries:    s.httpRetries.Load(),
		ObjectsFetched: s.objectsFetched.Load(),
		BytesFetched:   s.bytesFetched.Load(),
		CacheHits:      s.cacheHits.Load(),
		CacheMisses:    s.cacheMisses.Load(),
	}
}
