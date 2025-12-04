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
// To prevent memory leaks from CUE's internal caching, we store the schema source string
// and compile it in a fresh context for each validation. This allows the context and its
// internal caches to be garbage collected after each validation.
type Validator struct {
	schemaSource string
	schemaPath   cue.Path
	mu           sync.Mutex
}

// NewValidatorFromSource creates a new validator from a schema source string and path.
// This prevents memory leaks by allowing each validation to use a fresh CUE context.
func NewValidatorFromSource(schemaSource string, schemaPath cue.Path) *Validator {
	return &Validator{
		schemaSource: schemaSource,
		schemaPath:   schemaPath,
	}
}

func (v *Validator) Validate(data []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()

	// Create a fresh CUE context for each validation to prevent memory leaks.
	// CUE contexts cache intermediate computation results (disjunctions, unifications, etc.),
	// and reusing the same context causes these caches to grow unboundedly.
	//
	// We compile the schema in a fresh context for each validation. While this means
	// recompiling the schema each time, it's necessary to prevent memory leaks. The schema
	// compilation is relatively fast compared to the validation itself, and the memory
	// leak would be much worse without this approach.
	cueCtx := cuecontext.New()
	compiledSchema := cueCtx.CompileString(v.schemaSource).LookupPath(v.schemaPath)
	return cuejson.Validate(data, compiledSchema)
}
