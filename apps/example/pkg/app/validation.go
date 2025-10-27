package app

import (
	"context"
	"errors"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
)

var _ simple.KindValidator = NewValidator()

// Validator implements simple.KindValidator
type Validator struct{}

func NewValidator() *Validator {
	return &Validator{}
}

// Validate runs any kind of validation on incoming objects,
// and returns an error to reject the request.
// Here, we just reject any Example resource which is named "invalid"
func (v *Validator) Validate(ctx context.Context, req *app.AdmissionRequest) error {
	if req.Object.GetName() == "invalid" {
		return errors.New("example cannot be named 'invalid'")
	}
	return nil
}
