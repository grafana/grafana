package validator

import "context"

type FakeAnonUserLimitValidator struct {
}

var _ AnonUserLimitValidator = (*FakeAnonUserLimitValidator)(nil)

func (f FakeAnonUserLimitValidator) Validate(_ context.Context) error {
	return nil
}
