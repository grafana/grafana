package ringq

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	// make sure we don't leak goroutines after tests in this package have
	// finished. This is especially interesting as DynChan uses a
	// different goroutine to coordinate work
	goleak.VerifyTestMain(m)
}

func TestDynChan(t *testing.T) {
	t.Parallel()

	const dLen = 512
	data := ints(dLen)
	data2 := append(data, data...)

	canceledContext, cancel := context.WithCancel(context.Background())
	cancel()
	<-canceledContext.Done()

	t.Run("panic on absurd input", func(t *testing.T) {
		t.Parallel()

		require.Panics(t, func() {
			DynChanMax[int](0, 0)
		}, "minBufLen < 1")

		require.Panics(t, func() {
			DynChanMax[int](10, 5)
		}, "maxBufLen > 0 && maxBufLen < minBufLen")
	})

	t.Run("basic operation - with maxBufLen", func(t *testing.T) {
		t.Parallel()

		const (
			minBufLen = 32
			maxLen    = 128
		)
		in, out, sr := DynChanMax[int](minBufLen, maxLen)
		cleanupChans(t, in, out, sr)

		sendNB(t, in, data...)
		sendNB(t, in, data...)
		sendNB(t, in, data...)

		stats, err := sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, maxLen, stats.Len)
		require.Equal(t, maxLen, stats.Cap)
		require.GreaterOrEqual(t, stats.Allocs, uint64(5))
		require.Equal(t, uint64(3*dLen), stats.Enqueued)
		require.Equal(t, uint64(0), stats.Dequeued)
		require.Equal(t, uint64(3*dLen-maxLen), stats.Dropped)
		require.Equal(t, uint64(0), stats.StatsRead)

		got := make([]int, maxLen)
		recvNB(t, out, got)
		require.Equal(t, data[len(data)-maxLen:], got)
		stats, err = sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, 0, stats.Len)
		require.Equal(t, minBufLen, stats.Cap)
		require.GreaterOrEqual(t, stats.Allocs, uint64(5))
		require.Equal(t, uint64(3*dLen), stats.Enqueued)
		require.Equal(t, uint64(len(got)), stats.Dequeued)
		require.Equal(t, uint64(3*dLen-maxLen), stats.Dropped)
		require.Equal(t, uint64(1), stats.StatsRead)
	})

	t.Run("basic operation - without maxBufLen", func(t *testing.T) {
		t.Parallel()

		in, out, sr := DynChan[int](dLen)
		cleanupChans(t, in, out, sr)

		stats, err := sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, ChanStats{}, stats)

		sendNB(t, in, data...)
		stats, err = sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, ChanStats{
			Len:       dLen,
			Cap:       dLen,
			Allocs:    1,
			Enqueued:  dLen,
			StatsRead: 1,
		}, stats)

		got := make([]int, dLen)
		recvNB(t, out, got)
		require.Equal(t, data, got)
		stats, err = sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, ChanStats{
			Len:       0,
			Cap:       dLen,
			Allocs:    1,
			Enqueued:  dLen,
			Dequeued:  dLen,
			StatsRead: 2,
		}, stats)

		sendNB(t, in, data2...)
		stats, err = sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, 2*dLen, stats.Len)
		require.GreaterOrEqual(t, stats.Cap, 2*dLen)
		require.GreaterOrEqual(t, stats.Allocs, uint64(2))
		require.Equal(t, uint64(3*dLen), stats.Enqueued)
		require.Equal(t, uint64(dLen), stats.Dequeued)
		require.Equal(t, uint64(0), stats.Dropped)
		require.Equal(t, uint64(3), stats.StatsRead)

		got = make([]int, 2*dLen)
		recvNB(t, out, got)
		require.Equal(t, data2, got)
		stats, err = sr.ReadStats(ctxFromTest(t))
		require.NoError(t, err)
		require.Equal(t, 0, stats.Len)
		require.Equal(t, dLen, stats.Cap, "capacity not recovered")
		require.GreaterOrEqual(t, stats.Allocs, uint64(3))
		require.Equal(t, uint64(3*dLen), stats.Enqueued)
		require.Equal(t, uint64(3*dLen), stats.Dequeued)
		require.Equal(t, uint64(0), stats.Dropped)
		require.Equal(t, uint64(4), stats.StatsRead)

		// test edge case of context canceled while reading stats. Testing this
		// requires racing in the select of ChanStatsReader.ReadStats, because
		// in case a select can pick from more than one case, it picks at
		// random. In our case, we have 2 cases, so the probability of picking
		// one case over the other is 1 in 2^maxAttempts (assuming true
		// randomness).
		const maxAttempts = 100_000
		var wonRace bool
		for i := 0; i < maxAttempts; i++ {
			stats, err = sr.ReadStats(canceledContext)
			if err != nil {
				require.ErrorIs(t, err, context.Canceled)
				require.Equal(t, ChanStats{}, stats)
				t.Logf("race won in iteration %d", i)
				wonRace = true
				break
			}
		}
		require.True(t, wonRace, "lost race after %d attempts", maxAttempts)
	})
}

func cleanupChans[T any](t *testing.T, in chan<- T, out <-chan T, sr ChanStatsReader) {
	t.Helper()
	t.Cleanup(func() {
		close(in)
		var canceled, hasVal bool
		var val T
		select {
		case val, hasVal = <-out:
		case <-ctxFromTest(t).Done():
			canceled = true
		}
		require.False(t, canceled, "context canceled while closing queue")
		require.False(t, hasVal, "unexpected value while closing %v", val)

		stats, err := sr.ReadStats(ctxFromTest(t))
		require.Error(t, err)
		require.ErrorIs(t, err, ErrDynChanClosed)
		require.Equal(t, ChanStats{}, stats)
	})
}

func ctxFromTest(t *testing.T) context.Context {
	return ctxFromTestWithDefault(t, time.Second)
}

func ctxFromTestWithDefault(t *testing.T, d time.Duration) context.Context {
	require.Greater(t, d, 0*time.Second)
	deadline, ok := t.Deadline()
	if !ok {
		deadline = time.Now().Add(d)
	}
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	t.Cleanup(cancel)
	return ctx
}

func sendNB[T any](t *testing.T, in chan<- T, s ...T) {
	t.Helper()
	var canceled bool
	for i, v := range s {
		require.NotPanics(t, func() {
			select {
			case in <- v:
			case <-ctxFromTest(t).Done():
				canceled = true
			}
		})
		require.False(t, canceled, "context canceled while sending item %d/%d", i+1, len(s))
	}
}

func recvNB[T any](t *testing.T, out <-chan T, s []T) {
	t.Helper()
	var canceled bool
	for i := range s {
		select {
		case s[i] = <-out:
		case <-ctxFromTest(t).Done():
			canceled = true
		}
		require.False(t, canceled, "context canceled while receiving item %d/%d", i+1, len(s))
	}
}
