package live

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func Test_runConcurrentlyIfNeeded_Concurrent(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	semaphore := make(chan struct{}, 2)
	err := runConcurrentlyIfNeeded(context.Background(), semaphore, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_NoConcurrency(t *testing.T) {
	doneCh := make(chan struct{})
	f := func() {
		close(doneCh)
	}
	err := runConcurrentlyIfNeeded(context.Background(), nil, f)
	require.NoError(t, err)

	select {
	case <-doneCh:
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for function execution")
	}
}

func Test_runConcurrentlyIfNeeded_DeadlineExceeded(t *testing.T) {
	f := func() {}
	semaphore := make(chan struct{}, 2)
	semaphore <- struct{}{}
	semaphore <- struct{}{}

	ctx, cancel := context.WithDeadline(context.Background(), time.Now().Add(-time.Second))
	defer cancel()
	err := runConcurrentlyIfNeeded(ctx, semaphore, f)
	require.ErrorIs(t, err, context.DeadlineExceeded)
}
