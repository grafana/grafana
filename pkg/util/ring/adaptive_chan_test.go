package ring

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.uber.org/goleak"
)

func TestMain(m *testing.M) {
	// make sure we don't leak goroutines after tests in this package have
	// finished. This is especially important as AdaptiveChan uses a different
	// goroutine to coordinate work
	goleak.VerifyTestMain(m)
}

func TestAdaptiveChan(t *testing.T) {
	t.Parallel()

	t.Run("edge case - close send and controller after creation", func(t *testing.T) {
		t.Parallel()
		send, recv, ctrl := AdaptiveChan[int]()
		cleanupAC(t, send, recv, ctrl)
	})

	t.Run("basic operation", func(t *testing.T) {
		t.Parallel()
		var stats, expectedStats AdaptiveChanStats

		send, recv, ctrl := AdaptiveChan[int]()
		cleanupAC(t, send, recv, ctrl)

		sendNonBlock(t, send, ints(10)...)
		ctrl.WriteStats(ctxFromTest(t), &stats)
		removeAllocStats(&stats.RingStats)
		expectedStats.Len = 10
		expectedStats.Enqueued = 10
		require.Equal(t, expectedStats, stats)

		recvNonBlock(t, recv, ints(10)...)
		ctrl.WriteStats(ctxFromTest(t), &stats)
		removeAllocStats(&stats.RingStats)
		expectedStats.Len = 0
		expectedStats.Dequeued = 10
		expectedStats.StatsRead = 1
		require.Equal(t, expectedStats, stats)
	})

	t.Run("using commands to control the ring", func(t *testing.T) {
		t.Parallel()
		send, recv, ctrl := AdaptiveChan[int]()
		cleanupAC(t, send, recv, ctrl)

		var stats, expectedStats AdaptiveChanStats
		expectedStats.Min = 10
		expectedStats.Max = 20

		ctrl.Min(ctxFromTest(t), expectedStats.Min)
		ctrl.Max(ctxFromTest(t), expectedStats.Max)

		sendNonBlock(t, send, 1)
		ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Equal(t, expectedStats.Min, stats.Cap, "failed to allocate Min")
		removeAllocStats(&stats.RingStats)
		expectedStats.Len = 1
		expectedStats.Enqueued = 1
		require.Equal(t, expectedStats, stats)

		ctrl.Grow(ctxFromTest(t), (expectedStats.Max+expectedStats.Min)/2-1)
		ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Equal(t, (expectedStats.Max+expectedStats.Min)/2, stats.Cap, "failed to Grow")

		ctrl.Shrink(ctxFromTest(t), expectedStats.Min)
		ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Equal(t, expectedStats.Min+1, stats.Cap, "failed to Shrink")

		ctrl.Clear(ctxFromTest(t))
		ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Equal(t, expectedStats.Min, stats.Cap, "failed to Clear")
	})

	t.Run("use of send and recv channels with a closed controller", func(t *testing.T) {
		t.Parallel()
		send, recv, ctrl := AdaptiveChan[int]()

		ctrl.Close()
		assertCtrlWriteErr(t, ctrl, ctxFromTest(t), ErrAdaptiveChanControllerClosed)

		sendNonBlock(t, send, ints(10)...)
		recvNonBlock(t, recv, ints(10)...)
		close(send)
		shouldBeClosed(t, recv)
	})
}

func TestSendOrErr(t *testing.T) {
	t.Parallel()
	const val = 44203
	var c chan int

	err := sendOrErr(ctxFromTest(t), c, val)
	require.Error(t, err)
	require.ErrorIs(t, err, ErrAdaptiveChanControllerClosed)

	c = make(chan int, 1)
	err = sendOrErr(ctxFromTest(t), c, val)
	require.NoError(t, err)

	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	err = sendOrErr(canceledCtx, c, val)
	require.Error(t, err)
	require.ErrorIs(t, err, context.Canceled)

	select {
	case v, ok := <-c:
		require.True(t, ok)
		require.Equal(t, val, v)
	default:
		t.Fatalf("value not sent to channel")
	}
}

func TestRecvOrErr(t *testing.T) {
	t.Parallel()
	const (
		val     = 44203
		witness = -1
	)
	var c chan int

	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()

	got := witness
	err := recvOrErr(canceledCtx, c, &got)
	require.Error(t, err)
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, witness, got)

	c = make(chan int, 1)
	c <- val

	err = recvOrErr(ctxFromTest(t), c, &got)
	require.NoError(t, err)
	require.Equal(t, val, got)

	close(c)
	got = witness
	err = recvOrErr(ctxFromTest(t), c, &got)
	require.ErrorIs(t, err, ErrAdaptiveChanClosed)
	require.Equal(t, witness, got)
}

// cleanupAC closes the send channel and the controller, and perform a series of
// rutinary assertions.
func cleanupAC[T any](t *testing.T, send chan<- T, recv <-chan T, ctrl *AdaptiveChanController) {
	t.Cleanup(func() {
		close(send)
		shouldBeClosed(t, recv)

		var stats AdaptiveChanStats
		err := ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrAdaptiveChanClosed)
		require.Equal(t, AdaptiveChanStats{}, stats)

		canceledCtx, cancel := context.WithCancel(context.Background())
		cancel()
		assertCtrlWriteErr(t, ctrl, canceledCtx, context.Canceled)

		ctrl.Close()

		err = ctrl.WriteStats(ctxFromTest(t), &stats)
		require.Error(t, err)
		require.ErrorIs(t, err, ErrAdaptiveChanControllerClosed)
		require.Equal(t, AdaptiveChanStats{}, stats)

		assertCtrlWriteErr(t, ctrl, ctxFromTest(t), ErrAdaptiveChanControllerClosed)
	})
}

func assertCtrlWriteErr(t *testing.T, ctrl *AdaptiveChanController, ctx context.Context, expectedErr error) {
	t.Helper()

	err := ctrl.Min(ctx, 1)
	require.Error(t, err)
	require.ErrorIs(t, err, expectedErr)

	err = ctrl.Max(ctx, 1)
	require.Error(t, err)
	require.ErrorIs(t, err, expectedErr)

	err = ctrl.Grow(ctx, 1)
	require.Error(t, err)
	require.ErrorIs(t, err, expectedErr)

	err = ctrl.Shrink(ctx, 1)
	require.Error(t, err)
	require.ErrorIs(t, err, expectedErr)

	err = ctrl.Clear(ctx)
	require.Error(t, err)
	require.ErrorIs(t, err, expectedErr)
}

func shouldBeClosed[T any](t *testing.T, recv <-chan T) {
	t.Helper()
	select {
	case v, ok := <-recv:
		require.False(t, ok, "unexpected value %q received", v)
	case <-ctxFromTest(t).Done():
		t.Fatalf("context canceled where recv chan should be closed")
	}
}

func sendNonBlock[T any](t *testing.T, send chan<- T, s ...T) {
	t.Helper()
	var canceled bool
	for i, v := range s {
		require.NotPanics(t, func() {
			select {
			case send <- v:
			case <-ctxFromTest(t).Done():
				canceled = true
			}
		})
		require.False(t, canceled, "context canceled while sending item %d/%d", i+1, len(s))
	}
}

func recvNonBlock[T any](t *testing.T, recv <-chan T, s ...T) {
	t.Helper()
	var canceled bool
	for i := range s {
		select {
		case s[i] = <-recv:
		case <-ctxFromTest(t).Done():
			canceled = true
		}
		require.False(t, canceled, "context canceled while receiving item %d/%d", i+1, len(s))
	}
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
