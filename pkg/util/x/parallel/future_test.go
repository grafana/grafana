package parallel

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/stretchr/testify/assert"
)

func TestFutureCatchPanic(t *testing.T) {
	const msg = "Panicking in the Future"
	ctx := context.Background()
	f := RunFuture(ctx, func(ctx context.Context) (int, error) {
		panic(msg)
	}, FutureOpts{})

	result := f.Wait(ctx)
	assert.ErrorContains(t, result.Error, msg)
	assert.Empty(t, result.Value)
}

func TestFuture_Wait_RunTwice(t *testing.T) {
	ctx := context.Background()
	f := RunFuture(ctx, func(ctx context.Context) (int, error) {
		return 42, nil
	}, FutureOpts{})

	result := f.Wait(ctx)
	require.NoError(t, result.Error)
	assert.Equal(t, 42, result.Value)

	result = f.Wait(ctx)
	require.NoError(t, result.Error)
	assert.Equal(t, 42, result.Value)
}

func TestFuture_Get(t *testing.T) {
	ctx := context.Background()
	wg := &sync.WaitGroup{}
	wg.Add(1)
	f := RunFuture(ctx, func(ctx context.Context) (int, error) {
		wg.Wait()
		return 42, nil
	}, FutureOpts{})

	result, ok := f.Get()
	assert.False(t, ok)
	assert.Empty(t, result)

	wg.Done()
	<-f.done

	result, ok = f.Get()
	assert.True(t, ok)
	require.NoError(t, result.Error)
	assert.Equal(t, 42, result.Value)
}

func TestFutureOpts_Now(t *testing.T) {
	// veryLargeDelta will let us assume that time.Now() is roughly
	// equal to all other time.Now() in the test.
	const veryLargeDelta = float64(3 * time.Second)

	fakeTimestamp := time.Date(2002, 1, 1, 0, 0, 1, 0, time.UTC)
	tests := []struct {
		name              string
		nowFunc           func() time.Time
		expectedTimestamp time.Time
	}{
		{name: "not set (using time.Now())", nowFunc: nil, expectedTimestamp: time.Now()},
		{name: "set to time.Now()", nowFunc: time.Now, expectedTimestamp: time.Now()},
		{name: "set to specific time", nowFunc: func() time.Time {
			return fakeTimestamp
		}, expectedTimestamp: fakeTimestamp},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			o := FutureOpts{
				NowFunc: tc.nowFunc,
			}
			assert.InDelta(t, tc.expectedTimestamp.UnixNano(), o.Now().UnixNano(), veryLargeDelta)
		})
	}
}
