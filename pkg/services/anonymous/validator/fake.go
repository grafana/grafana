package validator

import "context"

type FakeAnonLimitValidator struct {
}

var _ AnonLimitValidator = (*FakeAnonLimitValidator)(nil)

func (f FakeAnonLimitValidator) Validate(_ context.Context) error {
	return nil
}
