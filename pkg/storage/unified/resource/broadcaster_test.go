package resource

import (
	"context"
	"testing"
	"time"

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
	input := []int{1, 2, 3}
	go func() {
		for _, v := range input {
			ch <- v
		}
	}()
	t.Cleanup(func() {
		close(ch)
	})

	b := NewBroadcaster(ctx, ch)

	sub, err := b.Subscribe(ctx)
	require.NoError(t, err)

	for _, expected := range input {
		v, ok := <-sub
		require.True(t, ok)
		require.Equal(t, expected, v)
	}

	// cancel the context should close the stream
	cancel()
	_, ok := <-sub
	require.False(t, ok)
}

func TestBroadcasterSlowConsumerDeadlock(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	ch := make(chan int)
	b := NewBroadcaster(ctx, ch)

	// Create 101 subscribers that never read — more than the
	// unsubscribe channel buffer (100) in the original code.
	const numSubs = chanBufferLen + 1
	for i := 0; i < numSubs; i++ {
		_, err := b.Subscribe(ctx)
		require.NoError(t, err)
	}

	// Fill all subscriber buffers (each buffered at 100), and keep sending more elements.
	//
	// Since all subscribers are slow, they should get unsubscribed
	// eventually. In the original code, unsubscribing buf size + 1 subscribers would deadlock.
	// Use a timeout to detect the deadlock.
	done := make(chan struct{})
	go func() {
		for i := 0; i < 10*chanBufferLen; i++ {
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
