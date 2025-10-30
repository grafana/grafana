package cuevalidator

import (
	"sync"

	"cuelang.org/go/cue"
	cuejson "cuelang.org/go/encoding/json"
)

// Validator provides thread-safe CUE schema validation.
//
// CUE is not safe for concurrent use: https://github.com/cue-lang/cue/discussions/1205#discussioncomment-1189238
// This validator uses a mutex to protect concurrent access to the underlying CUE validation.
type Validator struct {
	schema cue.Value
	mu     sync.Mutex
}

func NewValidator(schema cue.Value) *Validator {
	return &Validator{
		schema: schema,
	}
}

func (v *Validator) Validate(data []byte) error {
	v.mu.Lock()
	defer v.mu.Unlock()
	return cuejson.Validate(data, v.schema)
}
