package resource

import (
	"context"
	"errors"
	"io"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"
)

func drainChan[T any](ch chan T) []T {
	close(ch)
	var out []T
	for v := range ch {
		out = append(out, v)
	}
	return out
}

func requireMetricValue(t *testing.T, collector prometheus.Collector, expected float64) {
	t.Helper()
	require.Equal(t, expected, testutil.ToFloat64(collector))
}

func requireMetricEventually(t *testing.T, collector prometheus.Collector, expected float64) {
	t.Helper()
	require.Eventually(t, func() bool {
		return testutil.ToFloat64(collector) == expected
	}, time.Second, 10*time.Millisecond)
}

func TestRingBuffer(t *testing.T) {
	c := newRingBuffer[int](10)

	// empty buffer
	dst := make(chan int, 10)
	require.True(t, c.readInto(dst))
	require.Empty(t, drainChan(dst))

	c.add(1)
	dst = make(chan int, 10)
	require.True(t, c.readInto(dst))
	require.Equal(t, []int{1}, drainChan(dst))

	for i := 2; i <= 6; i++ {
		c.add(i)
	}
	dst = make(chan int, 10)
	require.True(t, c.readInto(dst))
	require.Equal(t, []int{1, 2, 3, 4, 5, 6}, drainChan(dst))

	for i := 7; i <= 11; i++ {
		c.add(i)
	}

	// buffer is full (size 10), oldest item (1) evicted
	dst = make(chan int, 10)
	require.True(t, c.readInto(dst))
	require.Equal(t, []int{2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, drainChan(dst))

	c.add(12)
	c.add(13)

	// two more evictions
	dst = make(chan int, 10)
	require.True(t, c.readInto(dst))
	require.Equal(t, []int{4, 5, 6, 7, 8, 9, 10, 11, 12, 13}, drainChan(dst))

	// destination too small — returns false
	small := make(chan int, 1)
	require.False(t, c.readInto(small))
}

func TestBroadcaster(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	ch := make(chan int)
	reg := prometheus.NewPedanticRegistry()
	metrics := newBroadcasterMetrics(reg)
	input := []int{1, 2, 3}
	go func() {
		for _, v := range input {
			ch <- v
		}
	}()
	t.Cleanup(func() {
		close(ch)
	})

	b := NewBroadcaster(ctx, ch, metrics)

	sub, err := b.Subscribe(ctx, "test")
	require.NoError(t, err)

	for _, expected := range input {
		v, ok := <-sub
		require.True(t, ok)
		require.Equal(t, expected, v)
	}
	requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultOK), 1)
	requireMetricValue(t, metrics.EventsReceivedTotal, float64(len(input)))
	requireMetricEventually(t, metrics.Subscribers, 1)

	// cancel the context should close the stream
	cancel()
	_, ok := <-sub
	require.False(t, ok)
	requireMetricEventually(t, metrics.Subscribers, 0)
	requireMetricValue(t, metrics.UnsubscriptionsTotal.WithLabelValues(unsubscriptionReasonShutdown), 1)
}

func TestBroadcasterUnsubscribe(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	t.Cleanup(func() { close(ch) })
	reg := prometheus.NewPedanticRegistry()
	metrics := newBroadcasterMetrics(reg)

	b := NewBroadcaster(ctx, ch, metrics)

	// subscribe three, then unsubscribe all
	sub1, err := b.Subscribe(ctx, "sub1")
	require.NoError(t, err)
	sub2, err := b.Subscribe(ctx, "sub2")
	require.NoError(t, err)
	sub3, err := b.Subscribe(ctx, "sub3")
	require.NoError(t, err)

	b.Unsubscribe(sub1)
	b.Unsubscribe(sub2)
	b.Unsubscribe(sub3)

	// all subscriber channels should be closed
	_, ok := <-sub1
	require.False(t, ok)
	_, ok = <-sub2
	require.False(t, ok)
	_, ok = <-sub3
	require.False(t, ok)

	// broadcaster should still work — new subscriber receives data
	sub4, err := b.Subscribe(ctx, "sub4")
	require.NoError(t, err)

	ch <- 42
	v, ok := <-sub4
	require.True(t, ok)
	require.Equal(t, 42, v)
	requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultOK), 4)
	requireMetricValue(t, metrics.UnsubscriptionsTotal.WithLabelValues(unsubscriptionReasonClient), 3)
	requireMetricValue(t, metrics.EventsReceivedTotal, 1)
	requireMetricEventually(t, metrics.Subscribers, 1)
}

func TestBroadcasterSlowConsumerDeadlock(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)

	// Use small overflow cap so slow consumers get disconnected quickly.
	const subBuf = 10
	const ovfCap = 20
	b := newBroadcasterWithSizes(ctx, ch, subBuf, ovfCap, nil)

	// Create 101 subscribers that never read — enough to exceed the
	// internal unsubscribe channel buffer and exercise bulk disconnect.
	const numSubs = internalChanSize + 1
	for i := 0; i < numSubs; i++ {
		_, err := b.Subscribe(ctx, "test")
		require.NoError(t, err)
	}

	// Fill all subscriber buffers + overflow until cap is exceeded.
	// All subscribers are slow, so they all get disconnected on the same
	// event. Use a timeout to detect deadlock.
	done := make(chan struct{})
	go func() {
		for i := 0; i < subBuf+ovfCap+1; i++ {
			ch <- i
		}
		close(done)
	}()

	select {
	case <-done:
		// Success — no deadlock.
	case <-time.After(5 * time.Second):
		t.Fatal("deadlock: stream() blocked trying to unsubscribe slow consumers")
	}
}

func TestBroadcasterOverflowSpoolsInsteadOfDisconnecting(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	t.Cleanup(func() { close(ch) })

	const subBuf = 10
	const ovfCap = 100
	b := newBroadcasterWithSizes(ctx, ch, subBuf, ovfCap, nil)

	sub, err := b.Subscribe(ctx, "test")
	require.NoError(t, err)

	// Send more items than the subscriber buffer can hold.
	// With overflow, the subscriber should NOT be disconnected.
	const totalItems = subBuf + 20
	go func() {
		for i := 0; i < totalItems; i++ {
			ch <- i
		}
	}()

	// Read all items — they should arrive in order.
	for i := 0; i < totalItems; i++ {
		select {
		case v, ok := <-sub:
			require.True(t, ok, "subscriber channel closed prematurely at item %d", i)
			require.Equal(t, i, v)
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for item %d", i)
		}
	}
}

func TestBroadcasterDisconnectsOnOverflowCapExceeded(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	t.Cleanup(func() { close(ch) })
	reg := prometheus.NewPedanticRegistry()
	metrics := newBroadcasterMetrics(reg)

	const subBuf = 10
	const ovfCap = 20
	b := newBroadcasterWithSizes(ctx, ch, subBuf, ovfCap, metrics)

	sub, err := b.Subscribe(ctx, "test")
	require.NoError(t, err)

	// Send enough items to fill buffer + exceed overflow cap.
	// The subscriber never reads, so it should be disconnected.
	done := make(chan struct{})
	go func() {
		for i := 0; i < subBuf+ovfCap+10; i++ {
			ch <- i
		}
		close(done)
	}()

	// Wait for all sends to complete — stream() processes them, subscriber
	// gets disconnected after overflow cap exceeded.
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out: sender blocked")
	}

	// Drain any buffered items; channel should be closed.
	for {
		select {
		case _, ok := <-sub:
			if !ok {
				requireMetricEventually(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultOK), 1)
				requireMetricEventually(t, metrics.EventsReceivedTotal, float64(subBuf+ovfCap+10))
				requireMetricEventually(t, metrics.OverflowEventsTotal, float64(ovfCap+1))
				requireMetricEventually(t, metrics.UnsubscriptionsTotal.WithLabelValues(unsubscriptionReasonOverflowCap), 1)
				requireMetricEventually(t, metrics.Subscribers, 0)
				return
			}
		case <-time.After(5 * time.Second):
			t.Fatal("timed out: subscriber was not disconnected after overflow cap exceeded")
		}
	}
}

func TestBroadcasterReadIntoDoesNotFillChannel(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	t.Cleanup(func() { close(ch) })

	// Subscriber buffer (defaultCacheSize + 100) > defaultCacheSize,
	// so readInto should leave headroom.
	const subBuf = defaultCacheSize + 100
	const ovfCap = 1000
	b := newBroadcasterWithSizes(ctx, ch, subBuf, ovfCap, nil)

	// Fill the cache to capacity by sending items through the input channel
	// (no subscribers yet, so items only go to cache).
	for i := 0; i < defaultCacheSize; i++ {
		ch <- i
	}

	// Subscribe — readInto sends all cached items into the subscriber channel.
	sub, err := b.Subscribe(ctx, "test")
	require.NoError(t, err)

	// Read one cached item to confirm the subscription is active.
	select {
	case _, ok := <-sub:
		require.True(t, ok)
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for first cached item")
	}

	// Send additional events. The channel has headroom (buffer > cache)
	// so these arrive without overflowing.
	const extra = 10
	for i := 0; i < extra; i++ {
		ch <- 1000 + i
	}

	// Read all remaining items — subscriber should still be alive.
	for i := 0; i < extra; i++ {
		select {
		case _, ok := <-sub:
			require.True(t, ok, "subscriber disconnected at item %d", i)
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out at item %d of %d", i, extra)
		}
	}
}

func TestBroadcasterOverflowMemoryReleasedWhenCaughtUp(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	t.Cleanup(func() { close(ch) })
	reg := prometheus.NewPedanticRegistry()
	metrics := newBroadcasterMetrics(reg)

	const subBuf = 10
	const ovfCap = 100
	b := newBroadcasterWithSizes(ctx, ch, subBuf, ovfCap, metrics)

	sub, err := b.Subscribe(ctx, "test")
	require.NoError(t, err)

	// Send more items than the channel buffer can hold, causing overflow.
	const totalItems = subBuf + 15
	go func() {
		for i := 0; i < totalItems; i++ {
			ch <- i
		}
	}()

	// Read all items to catch up.
	for i := 0; i < totalItems; i++ {
		select {
		case _, ok := <-sub:
			require.True(t, ok)
		case <-time.After(2 * time.Second):
			t.Fatalf("timed out waiting for item %d", i)
		}
	}

	// Send one more event to confirm the subscriber is still alive
	// and the overflow path is not active.
	ch <- 999
	select {
	case v, ok := <-sub:
		require.True(t, ok)
		require.Equal(t, 999, v)
	case <-time.After(2 * time.Second):
		t.Fatal("timed out: subscriber not responsive after overflow recovery")
	}

	// Verify overflow is nil by checking internal state.
	// The subscriber should have no overflow since it caught up.
	s := b.subs[sub]
	require.NotNil(t, s, "subscriber should still exist")
	require.Nil(t, s.overflow, "overflow should be nil after subscriber caught up")
	requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultOK), 1)
	requireMetricValue(t, metrics.EventsReceivedTotal, float64(totalItems+1))
	requireMetricValue(t, metrics.UnsubscriptionsTotal.WithLabelValues(unsubscriptionReasonOverflowCap), 0)
	requireMetricEventually(t, metrics.Subscribers, 1)
}

func TestBroadcasterMetricsSubscribeFailures(t *testing.T) {
	t.Run("context canceled", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()
		metrics := newBroadcasterMetrics(reg)

		ctx := context.Background()
		subCtx, subCancel := context.WithCancel(ctx)
		subCancel()

		b := &broadcaster[int]{
			subscribe:    make(chan *subscription[int]),
			terminated:   make(chan struct{}),
			metrics:      metrics,
			watchBufSize: watchChanSize,
		}

		_, err := b.Subscribe(subCtx, "sub1")
		require.Error(t, err)
		requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultCtxCanceled), 1)
	})

	t.Run("terminated", func(t *testing.T) {
		reg := prometheus.NewPedanticRegistry()
		metrics := newBroadcasterMetrics(reg)

		ctx := context.Background()
		input := make(chan int)
		b := newBroadcasterWithSizes(ctx, input, watchChanSize, defaultOverflowCap, metrics)
		close(input)

		require.Eventually(t, func() bool {
			_, err := b.Subscribe(ctx, "sub1")
			return errors.Is(err, io.EOF)
		}, time.Second, 10*time.Millisecond)
		requireMetricValue(t, metrics.SubscriptionsTotal.WithLabelValues(subscriptionResultTerminated), 1)
	})
}
