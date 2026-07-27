// Package exprcapture records the shape of the executed server-side expression pipeline in memory
// for the on-demand diagnostics bundle. When a capture Buffer is attached to the request context,
// the expression service records each pipeline node's refID, node type/command, input dependencies
// (the refIDs it consumes), and any error. The diagnostics bundle serializes these as an
// expression-stage view so a support engineer can localize the first processing stage whose output
// differs from its input.
//
// Node OUTPUTS are deliberately not captured here. The expression service returns every executed
// node -- datasource, expression and ML alike -- as its own refID in the QueryDataResponse, so the
// bundle's querydata.json already carries each stage's output frames under "response" keyed by
// refID. What that response cannot express is the DAG: which node is an expression, which command
// it ran, and which refIDs feed it. That is what this buffer adds, and a reader joins the two on
// refID. Capturing the frames again would duplicate the response byte-for-byte and halve the
// artifact's effective size budget.
//
// For that join to resolve for every stage, the presence of a Buffer also makes the expression
// service keep hidden ("hide": true) nodes in the response it returns, which it otherwise strips
// after execution -- see expr.Service.TransformData. A hidden datasource query feeding a visible
// expression is the usual panel shape, and it is precisely the stage whose output a support engineer
// needs in order to tell a bad datasource result from a bad expression.
//
// Like the other diagnostics capture buffers, this is a no-op unless a Buffer is present in the
// context, so the normal query path pays only a context lookup. Stage metadata is recorded VERBATIM
// -- redaction is intentionally deferred for the experimental, admin-only, on-prem, feature-flagged
// diagnostics endpoint (see the harcapture package doc).
package exprcapture

import (
	"context"
	"sync"
)

type contextKey struct{}

// Stage is one node of the executed expression pipeline: a datasource query or an expression command.
// InputRefIDs are the refIDs whose outputs feed this node (its inputs). A reader pairs each stage
// with the same refID under querydata.json's "response" to get its output, and reconstructs the
// stage's input from the outputs of its InputRefIDs -- so the pipeline can be walked from datasource
// nodes down to the panel's final expression to find where the data changed.
type Stage struct {
	RefID       string
	Type        string // "datasource", "expression", "ml", or "unknown" for a node kind we don't map
	Command     string // expression command (reduce/math/resample/...) or datasource type; may be empty
	InputRefIDs []string
	Error       error // node error (dependency/execution failure), if any
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

// Stages returns a shallow copy of the captured stages: the slice is fresh, and each Stage's
// InputRefIDs is already owned by the buffer (the recorder clones it off the pipeline node, which
// outlives neither the request nor this buffer). Thread-safe.
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
