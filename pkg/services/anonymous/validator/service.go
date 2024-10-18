package validator

import (
	"context"
)

type AnonLimitValidator interface {
	Validate(ctx context.Context) error
}

// AnonLimitValidatorImpl is used to validate the limit of Anonymous user
type AnonLimitValidatorImpl struct {
}

var _ AnonLimitValidator = (*AnonLimitValidatorImpl)(nil)

func ProvideAnonLimitValidator() *AnonLimitValidatorImpl {
	return &AnonLimitValidatorImpl{}
}

func (a AnonLimitValidatorImpl) Validate(_ context.Context) error {
	return nil
}
