package cuevalidator

import (
	"sync"
	"sync/atomic"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/encoding/json"
)

const (
	// maxValidations limits how many validations can use the same context before it's recreated.
	// This prevents unbounded memory growth while still allowing schema reuse for performance.
	// After this many validations, the context is discarded and a new one is created.
	maxValidations = 100
)

// Validator provides thread-safe CUE schema validation with periodic context recreation.
//
// CUE is not safe for concurrent use: https://github.com/cue-lang/cue/discussions/1205#discussioncomment-1189238
// This validator uses a mutex to protect concurrent access to the underlying CUE validation.
//
// To prevent memory leaks from CUE's internal caching, we reuse a context for up to maxValidations
// validations, then recreate it. This balances performance (schema reuse) with memory safety
// (periodic garbage collection of cached values).
//
// See https://github.com/grafana/grafana/issues/114344#issuecomment-3605562491 for details
// about the memory leak issue and this fix.
type Validator struct {
	schemaSource    string
	schemaPath      cue.Path
	mu              sync.Mutex
	ctx             *cue.Context
	compiledSchema  cue.Value
	validationCount atomic.Uint64
}

// NewValidatorFromSource creates a new validator from a schema source string and path.
// This prevents memory leaks by periodically recreating the CUE context after maxValidations uses.
func NewValidatorFromSource(schemaSource string, schemaPath cue.Path) *Validator {
	cueCtx := cuecontext.New()
	compiledSchema := cueCtx.CompileString(schemaSource).LookupPath(schemaPath)
	return &Validator{
		schemaSource:   schemaSource,
		schemaPath:     schemaPath,
		ctx:            cueCtx,
		compiledSchema: compiledSchema,
	}
}

func (v *Validator) Validate(data []byte) error {
	count := v.validationCount.Add(1)

	// If we've reached the maximum number of validations, recreate the context
	if count >= maxValidations {
		v.mu.Lock()
		// Double-check after acquiring lock (another goroutine might have already recreated)
		if v.validationCount.Load() >= maxValidations {
			// Recreate context to allow GC to reclaim cached values
			v.ctx = cuecontext.New()
			v.compiledSchema = v.ctx.CompileString(v.schemaSource).LookupPath(v.schemaPath)
			v.validationCount.Store(0)
		}
		v.mu.Unlock()
	}

	// Acquire lock to safely read the compiled schema
	v.mu.Lock()
	schema := v.compiledSchema
	v.mu.Unlock()

	return cuejson.Validate(data, schema)
}
