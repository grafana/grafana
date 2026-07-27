// Package exprcapture records per-node server-side expression pipeline evidence in memory for the
// on-demand diagnostics bundle. When a capture Buffer is attached to the request context, the
// expression service records each pipeline node's output frames, its input dependencies (the refIDs
// it consumes), its node type/command, and any error. The diagnostics bundle serializes these as an
// expression-stage view so a support engineer can localize the first processing stage whose output
// differs from its input.
//
// Like the other diagnostics capture buffers, this is a no-op unless a Buffer is present in the
// context, so the normal query path pays only a context lookup. Captured frames are recorded
// VERBATIM -- redaction is intentionally deferred for the experimental, admin-only, on-prem,
// feature-flagged diagnostics endpoint (see the harcapture package doc).
package exprcapture

import (
	"context"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/data"
)

type contextKey struct{}

// Stage is one node of the executed expression pipeline: a datasource query or an expression command.
// Frames is the node's output; InputRefIDs are the refIDs whose outputs feed this node (its inputs).
// A reader reconstructs each stage's input from the outputs of its InputRefIDs, so the pipeline can be
// walked from datasource nodes down to the panel's final expression to find where the data changed.
type Stage struct {
	RefID       string
	Type        string // "datasource", "expression", or "ml"
	Command     string // expression command (reduce/math/resample/...) or datasource type; may be empty
	InputRefIDs []string
	Frames      data.Frames // the node's output frames
	Error       error       // node error (dependency/execution failure), if any
}

// Buffer collects expression pipeline stages in execution order.
type Buffer struct {
	mu     sync.Mutex
	stages []Stage
}

// WithCapture returns a child context carrying a new Buffer and the buffer itself.
func WithCapture(ctx context.Context) (context.Context, *Buffer) {
	buf := &Buffer{}
	return context.WithValue(ctx, contextKey{}, buf), buf
}

// FromContext returns the Buffer stored in ctx, or nil if absent.
func FromContext(ctx context.Context) *Buffer {
	v, _ := ctx.Value(contextKey{}).(*Buffer)
	return v
}

// Record appends captured pipeline stages. A pipeline runs once per request, but Record appends
// (rather than replaces) so a request that evaluates more than one pipeline keeps every stage.
// Thread-safe.
func (b *Buffer) Record(stages []Stage) {
	if b == nil || len(stages) == 0 {
		return
	}
	b.mu.Lock()
	b.stages = append(b.stages, stages...)
	b.mu.Unlock()
}

// Stages returns a copy of the captured stages. Thread-safe.
func (b *Buffer) Stages() []Stage {
	if b == nil {
		return nil
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	out := make([]Stage, len(b.stages))
	copy(out, b.stages)
	return out
}

// Len returns the number of captured stages. Thread-safe.
func (b *Buffer) Len() int {
	if b == nil {
		return 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	return len(b.stages)
}
