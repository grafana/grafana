package cuevalidator

import (
	"sync"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/encoding/json"
)

// Validator provides thread-safe CUE schema validation.
//
// CUE is not safe for concurrent use: https://github.com/cue-lang/cue/discussions/1205#discussioncomment-1189238
// This validator uses a mutex to protect concurrent access to the underlying CUE validation.
//
// Validation is performed in a fresh CUE context on every call. CUE contexts
// accumulate internal state (adept.Vertex graphs and caches) that are never
// released while the context is alive, so a long-lived context leaks memory at
// steady write rates (see https://github.com/grafana/grafana/issues/114344 and
// https://github.com/grafana/grafana/issues/130336). Creating a context per
// validation — and recompiling the (immutable) schema into it — makes the whole
// validation graph garbage-collectable as soon as Validate returns.
type Validator struct {
	schemaSource string
	schemaPath   cue.Path
	mu           sync.Mutex
}

// NewValidatorFromSource creates a new validator from a schema source string and path.
func NewValidatorFromSource(schemaSource string, schemaPath cue.Path) *Validator {
	return &Validator{
		schemaSource: schemaSource,
		schemaPath:   schemaPath,
	}
}

func (v *Validator) Validate(data []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Use a fresh context per validation. CUE contexts hold references to every
	// value compiled into them, keeping validation-time allocations reachable
	// from the garbage collector. A per-call context has no such long-lived
	// references, so the whole validation graph is collected once the call
	// returns. The context itself is cheap to create; the embedded schema source
	// is recompiled into it, which is the only per-call cost.
	ctx := cuecontext.New()
	compiledSchema := ctx.CompileString(v.schemaSource).LookupPath(v.schemaPath)
	return cuejson.Validate(data, compiledSchema)
}
