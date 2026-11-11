package common

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// Consistently fails the test unless check passes on every sample it takes over
// waitFor. It runs check immediately and then once per tick until waitFor has
// elapsed.
//
// Use it instead of require.Never for any check that talks to the API server.
// Never runs its condition in a goroutine and returns the moment its timer
// fires, without waiting for a condition that is still running. A request still
// in flight at that point outlives the test body, and t.Context() is cancelled
// just before cleanups run — so the probe fails with "context canceled" and
// reports it against a test that had already passed.
//
// check runs on the calling goroutine, so it can use t directly: a require
// failure aborts at the first bad sample with the usual diff, and no goroutine
// is left behind to outlive the test.
func Consistently(t *testing.T, check func(t *testing.T), waitFor, tick time.Duration) {
	t.Helper()
	// time.NewTicker panics on a non-positive interval; fail with a useful message.
	require.Positive(t, tick, "Consistently requires a positive tick")

	timer := time.NewTimer(waitFor)
	defer timer.Stop()
	ticker := time.NewTicker(tick)
	defer ticker.Stop()

	for {
		check(t)

		// Because check ran inline, the deadline is only ever observed between
		// samples — never while one is still in flight. That is the whole
		// difference from require.Never.
		select {
		case <-timer.C:
			return
		case <-ticker.C:
		}
	}
}
