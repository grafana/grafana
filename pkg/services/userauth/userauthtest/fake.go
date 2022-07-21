package userauthtest

import "context"

type FakeUserAuthService struct {
	ExpectedError error
}

func NewFakeUserAuthService() *FakeUserAuthService {
	return &FakeUserAuthService{}
}

func (f *FakeUserAuthService) Delete(ctx context.Context, userID int64) error {
	return f.ExpectedError
}

func (f *FakeUserAuthService) DeleteToken(ctx context.Context, userID int64) error {
	return f.ExpectedError
}
