package loginattempttest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/loginattempt"
)

var _ loginattempt.Service = new(MockLoginAttemptService)

type MockLoginAttemptService struct {
	RecordAttemptCalled          bool
	ValidateAttemptsCalled       bool
	DeleteOldLoginAttemptsCalled bool

	ExpectedValid bool
	ExpectedErr   error
}

func (f *MockLoginAttemptService) RecordAttempt(ctx context.Context, username, IPAddress string) error {
	f.RecordAttemptCalled = true
	return f.ExpectedErr
}

func (f *MockLoginAttemptService) ValidateAttempts(ctx context.Context, username string) (bool, error) {
	f.ValidateAttemptsCalled = true
	return f.ExpectedValid, f.ExpectedErr
}

func (f *MockLoginAttemptService) DeleteOldLoginAttempts(ctx context.Context, cmd *loginattempt.DeleteOldLoginAttemptsCommand) error {
	f.DeleteOldLoginAttemptsCalled = true
	return f.ExpectedErr
}
