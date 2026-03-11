package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCache(t *testing.T) {
	c := newChannelCache[int](context.Background(), 10)

	e := []int{}
	err := c.Range(func(i int) error {
		e = append(e, i)
		return nil
	})
	require.Nil(t, err)
	require.Equal(t, 0, len(e))

	c.Add(1)

	e = []int{}
	err = c.Range(func(i int) error {
		e = append(e, i)
		return nil
	})
	require.Nil(t, err)
	require.Equal(t, 1, len(e))
	require.Equal(t, []int{1}, e)
	require.Equal(t, 1, c.Get(0))

	c.Add(2)
	c.Add(3)
	c.Add(4)
	c.Add(5)
	c.Add(6)

	// should be able to range over values
	e = []int{}
	err = c.Range(func(i int) error {
		e = append(e, i)
		return nil
	})
	require.Nil(t, err)
	require.Equal(t, 6, len(e))
	require.Equal(t, []int{1, 2, 3, 4, 5, 6}, e)

	// should be able to get length
	require.Equal(t, 6, c.Len())

	// should be able to get values
	require.Equal(t, 1, c.Get(0))
	require.Equal(t, 6, c.Get(5))
	// zero value beyond cache size
	require.Equal(t, 0, c.Get(6))
	require.Equal(t, 0, c.Get(20))
	require.Equal(t, 0, c.Get(-10))

	// slice should return all values
	require.Equal(t, []int{1, 2, 3, 4, 5, 6}, c.Slice())

	c.Add(7)
	c.Add(8)
	c.Add(9)
	c.Add(10)
	c.Add(11)

	// should be able to range over values
	e = []int{}
	err = c.Range(func(i int) error {
		e = append(e, i)
		return nil
	})
	require.Nil(t, err)
	require.Equal(t, 10, len(e))
	require.Equal(t, []int{2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, e)

	// should be able to get length
	require.Equal(t, 10, c.Len())

	// should be able to get values
	require.Equal(t, 2, c.Get(0))
	require.Equal(t, 3, c.Get(1))

	// slice should return all values
	require.Equal(t, []int{2, 3, 4, 5, 6, 7, 8, 9, 10, 11}, c.Slice())

	c.Add(12)
	c.Add(13)

	// should be able to range over values
	e = []int{}
	err = c.Range(func(i int) error {
		e = append(e, i)
		return nil
	})
	require.Nil(t, err)
	require.Equal(t, 10, len(e))
	require.Equal(t, []int{4, 5, 6, 7, 8, 9, 10, 11, 12, 13}, e)
	require.Equal(t, 4, c.Get(0))
	require.Equal(t, 5, c.Get(1))

	// slice should return all values
	require.Equal(t, []int{4, 5, 6, 7, 8, 9, 10, 11, 12, 13}, c.Slice())
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

	b, err := NewBroadcaster(ctx, func(out chan<- int) error {
		go func() {
			for v := range ch {
				out <- v
			}
		}()
		return nil
	})
	require.NoError(t, err)

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
	b, err := NewBroadcaster(ctx, func(out chan<- int) error {
		go func() {
			defer close(out)
			for v := range ch {
				out <- v
			}
		}()
		return nil
	})
	require.NoError(t, err)

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
