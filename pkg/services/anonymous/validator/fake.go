package validator

import "context"

type FakeAnonDeviceValidator struct {
}

var _ Service = (*FakeAnonDeviceValidator)(nil)

func (f FakeAnonDeviceValidator) Validate(_ context.Context) error {
	return nil
}
