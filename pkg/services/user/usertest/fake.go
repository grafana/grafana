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

func (f *FakeUserService) Delete(ctx context.Context, cmd *user.DeleteUserCommand) error {
	return f.ExpectedError
}

func (f *FakeUserService) GetByID(ctx context.Context, query *user.GetUserByIDQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserService) GetByLogin(ctx context.Context, query *user.GetUserByLoginQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserService) GetByEmail(ctx context.Context, query *user.GetUserByEmailQuery) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeUserService) Update(ctx context.Context, cmd *user.UpdateUserCommand) error {
	return f.ExpectedError
}

func (f *FakeUserService) ChangePassword(ctx context.Context, cmd *user.ChangeUserPasswordCommand) error {
	return f.ExpectedError
}

func (f *FakeUserService) UpdateLastSeenAt(ctx context.Context, cmd *user.UpdateUserLastSeenAtCommand) error {
	return f.ExpectedError
}
