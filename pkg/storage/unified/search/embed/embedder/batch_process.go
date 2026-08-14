package embedder

import (
	"context"
	"fmt"

	"golang.org/x/sync/errgroup"
)

// BatchFunc processes one chunk of inputs and returns one output per input,
// in the same order. Returning a different number of outputs than inputs is
// a contract violation and BatchProcess will surface it as an error.
type BatchFunc[I, O any] func(ctx context.Context, inputs []I) ([]O, error)

// BatchProcess splits inputs into chunks of `size` and runs `fn` on each
// concurrently. Outputs land in a single slice, in input order.
//
// All or nothing. If one or more batches fails, we return an error. Only
// succeeds and returns results when all batches were successful. Each
// callback must return exactly len(inputs) outputs; a count mismatch is
// reported as an error rather than silently leaving zero-value gaps.
//
// Provider-specific embedders use this to honor per-call batch limits
// (Vertex: 250, Bedrock Cohere: 96) without forcing the caller to chunk.
func BatchProcess[I, O any](ctx context.Context, inputs []I, size int, fn BatchFunc[I, O]) ([]O, error) {
	if len(inputs) == 0 {
		return nil, nil
	}
	if size <= 0 {
		size = len(inputs)
	}

	out := make([]O, len(inputs))
	g, gctx := errgroup.WithContext(ctx)

	for start := 0; start < len(inputs); start += size {
		s, e := start, min(start+size, len(inputs))
		g.Go(func() error {
			results, err := fn(gctx, inputs[s:e])
			if err != nil {
				return err
			}
			if len(results) != e-s {
				return fmt.Errorf("batch [%d:%d] returned %d outputs, expected %d", s, e, len(results), e-s)
			}
			copy(out[s:], results)
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	return out, nil
}
