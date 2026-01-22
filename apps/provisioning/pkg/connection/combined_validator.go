package connection

import (
	"context"

	"k8s.io/apiserver/pkg/admission"

	appadmission "github.com/grafana/grafana/apps/provisioning/pkg/apis/admission"
)

// CombinedValidator combines multiple validators for connection resources.
// It calls all validators in order and returns the first error encountered.
type CombinedValidator struct {
	validators []appadmission.Validator
}

// NewCombinedValidator creates a new combined validator that calls all provided validators.
func NewCombinedValidator(validators ...appadmission.Validator) appadmission.Validator {
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
