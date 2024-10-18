package validator

import (
	"context"
)

type AnonUserLimitValidator interface {
	Validate(ctx context.Context) error
}

// AnonUserLimitValidatorImpl is used to validate the limit of Anonymous user
type AnonUserLimitValidatorImpl struct {
}

var _ AnonUserLimitValidator = (*AnonUserLimitValidatorImpl)(nil)

func ProvideAnonUserLimitValidator() *AnonUserLimitValidatorImpl {
	return &AnonUserLimitValidatorImpl{}
}

func (a AnonUserLimitValidatorImpl) Validate(_ context.Context) error {
	return nil
}
