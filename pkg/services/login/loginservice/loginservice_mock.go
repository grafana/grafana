package loginservice

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LoginServiceMock struct {
	login.Service
	ExpectedUser     *user.User
	ExpectedUserFunc func(cmd *models.UpsertUserCommand) *user.User
	ExpectedError    error
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
