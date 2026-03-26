package admission

import (
	"context"

	"k8s.io/apiserver/pkg/admission"
)

// CombinedValidator combines multiple validators for a resource type.
// It calls all validators in order and returns the first error encountered.
type CombinedValidator struct {
	validators []Validator
}

// NewCombinedValidator creates a new combined validator that calls all provided validators.
func NewCombinedValidator(validators ...Validator) Validator {
	return &CombinedValidator{
		validators: validators,
	}
}

// Validate calls all validators in order and returns the first error encountered.
func (v *CombinedValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	for _, validator := range v.validators {
		if err := validator.Validate(ctx, a, o); err != nil {
			return err
		}
	}
	return nil
}
