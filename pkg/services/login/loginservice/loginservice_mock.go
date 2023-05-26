package loginservice

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LoginServiceMock struct {
	login.Service
	ExpectedUser     *user.User
	ExpectedUserFunc func(cmd *login.UpsertUserCommand) *user.User
	ExpectedError    error
}

func (s LoginServiceMock) UpsertUser(ctx context.Context, cmd *login.UpsertUserCommand) (*user.User, error) {
	if s.ExpectedUserFunc != nil {
		return s.ExpectedUserFunc(cmd), s.ExpectedError
	}
	return s.ExpectedUser, s.ExpectedError
}

func (s LoginServiceMock) DisableExternalUser(ctx context.Context, username string) error {
	return nil
}
