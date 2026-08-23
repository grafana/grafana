// Package writeflags carries per-request hints from the code that initiates a write down to the
// unified storage client that builds the gRPC request. The hint travels by context because the
// upstream storage.Interface signature is fixed, and it is re-applied at the loopback boundary
// because responsewriter rebuilds the request context from a whitelist.
package writeflags

import "context"

type skipArtificialSleepKey struct{}

// WithSkipArtificialSleep marks writes made with this context as not needing the server's
// search-after-write consistency delay.
func WithSkipArtificialSleep(ctx context.Context) context.Context {
	return context.WithValue(ctx, skipArtificialSleepKey{}, true)
}

// SkipArtificialSleep reports whether writes on this context should skip the server delay.
func SkipArtificialSleep(ctx context.Context) bool {
	v, _ := ctx.Value(skipArtificialSleepKey{}).(bool)
	return v
}
