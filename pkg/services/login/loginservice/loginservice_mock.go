package loginservice

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LoginServiceMock struct {
	login.Service
	ExpectedUserForm    dtos.AdminCreateUserForm
	NoExistingOrgId     int64
	AlreadyExitingLogin string
	GeneratedUserId     int64
	ExpectedUser        *user.User
	ExpectedUserFunc    func(cmd *models.UpsertUserCommand) *user.User
	ExpectedError       error
}

func (s LoginServiceMock) CreateUser(cmd user.CreateUserCommand) (*user.User, error) {
	if cmd.OrgID == s.NoExistingOrgId {
		return nil, models.ErrOrgNotFound
	}

	if cmd.Login == s.AlreadyExitingLogin {
		return nil, user.ErrUserAlreadyExists
	}

	if s.ExpectedUserForm.Login == cmd.Login && s.ExpectedUserForm.Email == cmd.Email &&
		s.ExpectedUserForm.Password == cmd.Password && s.ExpectedUserForm.Name == cmd.Name && s.ExpectedUserForm.OrgId == cmd.OrgID {
		return &user.User{ID: s.GeneratedUserId}, nil
	}

	return nil, errors.New("unexpected cmd")
}

func (s LoginServiceMock) UpsertUser(ctx context.Context, cmd *models.UpsertUserCommand) error {
	if s.ExpectedUserFunc != nil {
		cmd.Result = s.ExpectedUserFunc(cmd)
		return s.ExpectedError
	}
	cmd.Result = s.ExpectedUser
	return s.ExpectedError
}

func (s LoginServiceMock) DisableExternalUser(ctx context.Context, username string) error {
	return nil
}
