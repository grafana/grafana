package embedder

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// echoFn returns each input as its own output (identity); useful for
// verifying ordering without dragging in test-specific math.
func echoFn(_ context.Context, inputs []int) ([]int, error) {
	out := make([]int, len(inputs))
	copy(out, inputs)
	return out, nil
}

func TestBatchProcess_EmptyInputReturnsNil(t *testing.T) {
	out, err := BatchProcess(context.Background(), []int{}, 10, echoFn)
	require.NoError(t, err)
	assert.Nil(t, out)
}

func TestBatchProcess_PreservesOrderAcrossChunks(t *testing.T) {
	// 7 inputs split into chunks of 3 (chunks of 3, 3, 1). Verify the
	// reassembled output matches input order regardless of the order the
	// per-chunk goroutines complete in.
	inputs := []int{10, 11, 12, 13, 14, 15, 16}

	out, err := BatchProcess(context.Background(), inputs, 3, echoFn)
	require.NoError(t, err)
	assert.Equal(t, inputs, out)
}

func TestBatchProcess_LateChunkDoesntScrambleResult(t *testing.T) {
	// Force the second chunk (index 3 onward) to finish *after* the third
	// chunk by making its work artificially slow. If results land by
	// completion order instead of input order, this fails.
	inputs := []int{1, 2, 3, 4, 5, 6, 7}

	out, err := BatchProcess(context.Background(), inputs, 3, func(_ context.Context, batch []int) ([]int, error) {
		// chunk that owns "4,5,6" sleeps; the trailing chunk "7" returns first.
		if len(batch) > 0 && batch[0] == 4 {
			time.Sleep(50 * time.Millisecond)
		}
		out := make([]int, len(batch))
		copy(out, batch)
		return out, nil
	})
	require.NoError(t, err)
	assert.Equal(t, inputs, out)
}

func TestBatchProcess_OneChunkErrorCancelsOthers(t *testing.T) {
	// Two chunks: the first errors immediately, the second waits on ctx.
	// The second goroutine must observe ctx cancellation and return early.
	inputs := []int{1, 2, 3, 4}
	wantErr := errors.New("chunk one exploded")

	var siblingObservedCancel atomic.Bool
	_, err := BatchProcess(context.Background(), inputs, 2, func(ctx context.Context, batch []int) ([]int, error) {
		if batch[0] == 1 {
			return nil, wantErr
		}
		// Sibling chunk: wait until ctx fires (or a generous timeout).
		select {
		case <-ctx.Done():
			siblingObservedCancel.Store(true)
			return nil, ctx.Err()
		case <-time.After(2 * time.Second):
			return batch, nil
		}
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, wantErr)
	assert.True(t, siblingObservedCancel.Load(), "sibling chunk should have seen ctx cancellation")
}

func TestBatchProcess_SizeLargerThanInputUsesSingleChunk(t *testing.T) {
	var calls atomic.Int32
	_, err := BatchProcess(context.Background(), []int{1, 2, 3}, 100, func(_ context.Context, b []int) ([]int, error) {
		calls.Add(1)
		return b, nil
	})
	require.NoError(t, err)
	assert.Equal(t, int32(1), calls.Load(), "expected exactly one chunk when size > len(inputs)")
}

func TestBatchProcess_SizeZeroFallsBackToSingleChunk(t *testing.T) {
	// size <= 0 is treated as "one chunk for everything"; no division-by-
	// zero, no infinite loop.
	var calls atomic.Int32
	out, err := BatchProcess(context.Background(), []int{1, 2, 3}, 0, func(_ context.Context, b []int) ([]int, error) {
		calls.Add(1)
		return b, nil
	})
	require.NoError(t, err)
	assert.Equal(t, []int{1, 2, 3}, out)
	assert.Equal(t, int32(1), calls.Load())
}

func TestBatchProcess_RejectsTooFewResults(t *testing.T) {
	// Callback returns fewer outputs than inputs. Without explicit
	// validation, copy() would silently leave zero-value gaps; we surface it.
	_, err := BatchProcess(context.Background(), []int{1, 2, 3, 4}, 2, func(_ context.Context, inputs []int) ([]int, error) {
		// Always return one fewer than asked.
		return inputs[:len(inputs)-1], nil
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "returned 1 outputs, expected 2")
}

func TestBatchProcess_RejectsTooManyResults(t *testing.T) {
	// Callback returns more outputs than inputs — copy would silently
	// truncate; we reject.
	_, err := BatchProcess(context.Background(), []int{1, 2}, 2, func(_ context.Context, inputs []int) ([]int, error) {
		return append([]int{99}, inputs...), nil // 3 outputs for 2 inputs
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "returned 3 outputs, expected 2")
}

func TestBatchProcess_ParentContextCancellationPropagates(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already cancelled

	_, err := BatchProcess(ctx, []int{1, 2, 3, 4}, 2, func(ctx context.Context, b []int) ([]int, error) {
		// Each goroutine sees the cancelled context.
		<-ctx.Done()
		return nil, ctx.Err()
	})
	require.Error(t, err)
	assert.ErrorIs(t, err, context.Canceled)
}
