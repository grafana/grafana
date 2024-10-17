package validator

import (
	"context"
)

type Service interface {
	Validate(ctx context.Context) error
}

type AnonDeviceValidator struct {
}

var _ Service = (*AnonDeviceValidator)(nil)

func ProvideAnonDeviceValidator() *AnonDeviceValidator {
	return &AnonDeviceValidator{}
}

func (a AnonDeviceValidator) Validate(_ context.Context) error {
	return nil
}
