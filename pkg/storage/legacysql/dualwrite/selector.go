package dualwrite

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

type readModeReader interface {
	ReadFromUnified(context.Context, schema.GroupResource) (bool, error)
}

// Selector lets callers use their own interface for legacy and unified backends,
// without making legacy implementations depend on unified-storage RPC types.
type Selector[T any] struct {
	dual          readModeReader
	groupResource schema.GroupResource
	legacy        T
	unified       T
}

// NewSelector accepts a dual-write Service or any reader of the resource's read mode.
// T should describe the caller's operations, not the unified-storage protocol.
func NewSelector[T any](dual readModeReader, gr schema.GroupResource, legacy, unified T) *Selector[T] {
	return &Selector[T]{
		dual:          dual,
		groupResource: gr,
		legacy:        legacy,
		unified:       unified,
	}
}

// Resolve checks the mode on every call because migrations can change it at runtime.
// Call it for each operation rather than retaining the returned backend.
// A mode lookup error returns the zero value of T, never a fallback backend.
func (s *Selector[T]) Resolve(ctx context.Context) (T, error) {
	unified, err := s.dual.ReadFromUnified(ctx, s.groupResource)
	if err != nil {
		var zero T
		return zero, err
	}
	if unified {
		return s.unified, nil
	}
	return s.legacy, nil
}
