package loginattempttest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/loginattempt"
)

var _ loginattempt.Service = new(FakeLoginAttemptService)

type FakeLoginAttemptService struct {
	ExpectedValid bool
	ExpectedErr   error
}

func (f FakeLoginAttemptService) Add(ctx context.Context, username, IPAddress string) error {
	return f.ExpectedErr
}

func (f FakeLoginAttemptService) Reset(ctx context.Context, username string) error {
	return f.ExpectedErr
}

func (f FakeLoginAttemptService) Validate(ctx context.Context, username string) (bool, error) {
	return f.ExpectedValid, f.ExpectedErr
}

func (f FakeLoginAttemptService) ValidateIPAddress(ctx context.Context, IpAddress string) (bool, error) {
	return f.ExpectedValid, f.ExpectedErr
}
