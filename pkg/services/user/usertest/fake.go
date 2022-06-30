package usertest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type FakeUserService struct {
	ExpectedUser  *user.User
	ExpectedError error
}

func NewUserServiceFake() *FakeUserService {
	return &FakeUserService{}
}

func (f *FakeUserService) Create(ctx context.Context, cmd *user.CreateUserCommand) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}
