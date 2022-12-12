package loginattempttest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/loginattempt"
)

var _ loginattempt.Service = new(MockLoginAttemptService)

type MockLoginAttemptService struct {
	AddCalled      bool
	ResetCalled    bool
	ValidateCalled bool

	ExpectedValid bool
	ExpectedErr   error
}

func (f *MockLoginAttemptService) Add(ctx context.Context, username, IPAddress string) error {
	f.AddCalled = true
	return f.ExpectedErr
}

func (f *MockLoginAttemptService) Reset(ctx context.Context, username string) error {
	f.ResetCalled = true
	return f.ExpectedErr
}

func (f *MockLoginAttemptService) Validate(ctx context.Context, username string) (bool, error) {
	f.ValidateCalled = true
	return f.ExpectedValid, f.ExpectedErr
}
