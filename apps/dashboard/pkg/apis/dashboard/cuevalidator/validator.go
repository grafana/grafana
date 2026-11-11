package cuevalidator

import (
	"cuelang.org/go/cue"
	"cuelang.org/go/cue/cuecontext"
	cuejson "cuelang.org/go/encoding/json"
)

// Validator validates JSON using a separate CUE context for each call.
//
// CUE contexts retain compiled instances, so sharing a context across validations
// would keep validated payloads alive.
type Validator struct {
	schemaSource string
	schemaPath   cue.Path
}

// NewValidatorFromSource creates a new validator from a schema source string and path.
func NewValidatorFromSource(schemaSource string, schemaPath cue.Path) *Validator {
	return &Validator{
		schemaSource: schemaSource,
		schemaPath:   schemaPath,
	}
}

func (v *Validator) Validate(data []byte) error {
	cueCtx := cuecontext.New()
	compiledSchema := cueCtx.CompileString(v.schemaSource).LookupPath(v.schemaPath)
	return cuejson.Validate(data, compiledSchema)
}
