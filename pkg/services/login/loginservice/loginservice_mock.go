package loginservice

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
)

type LoginServiceMock struct {
	login.Service
	ExpectedUserForm    dtos.AdminCreateUserForm
	NoExistingOrgId     int64
	AlreadyExitingLogin string
	GeneratedUserId     int64
	ExpectedUser        *models.User
	ExpectedUserFunc    func(cmd *models.UpsertUserCommand) *models.User
	ExpectedError       error
}

func (s LoginServiceMock) CreateUser(cmd models.CreateUserCommand) (*models.User, error) {
	if cmd.OrgId == s.NoExistingOrgId {
		return nil, models.ErrOrgNotFound
	}

	if cmd.Login == s.AlreadyExitingLogin {
		return nil, models.ErrUserAlreadyExists
	}

	if s.ExpectedUserForm.Login == cmd.Login && s.ExpectedUserForm.Email == cmd.Email &&
		s.ExpectedUserForm.Password == cmd.Password && s.ExpectedUserForm.Name == cmd.Name && s.ExpectedUserForm.OrgId == cmd.OrgId {
		return &models.User{Id: s.GeneratedUserId}, nil
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
