package logintest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
)

type LoginServiceFake struct{}

func (l *LoginServiceFake) CreateUser(cmd models.CreateUserCommand) (*models.User, error) {
	return nil, nil
}
func (l *LoginServiceFake) UpsertUser(ctx context.Context, cmd *models.UpsertUserCommand) error {
	return nil
}
func (l *LoginServiceFake) DisableExternalUser(ctx context.Context, username string) error {
	return nil
}
func (l *LoginServiceFake) SetTeamSyncFunc(login.TeamSyncFunc) {}

type AuthInfoServiceFake struct {
	LatestUserID         int64
	ExpectedUserAuth     *models.UserAuth
	ExpectedUser         *models.User
	ExpectedExternalUser *models.ExternalUserInfo
	ExpectedError        error
}

func (a *AuthInfoServiceFake) LookupAndUpdate(ctx context.Context, query *models.GetUserByAuthInfoQuery) (*models.User, error) {
	if query.UserLookupParams.UserID != nil {
		a.LatestUserID = *query.UserLookupParams.UserID
	} else {
		a.LatestUserID = 0
	}
	return a.ExpectedUser, a.ExpectedError
}

func (a *AuthInfoServiceFake) GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error {
	a.LatestUserID = query.UserId
	query.Result = a.ExpectedUserAuth
	return a.ExpectedError
}

func (a *AuthInfoServiceFake) SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error {
	return a.ExpectedError
}

func (a *AuthInfoServiceFake) UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error {
	return a.ExpectedError
}

func (a *AuthInfoServiceFake) GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error {
	query.Result = a.ExpectedExternalUser
	return a.ExpectedError
}

type AuthenticatorFake struct {
	ExpectedUser  *models.User
	ExpectedError error
}

func (a *AuthenticatorFake) AuthenticateUser(c context.Context, query *models.LoginUserQuery) error {
	query.User = a.ExpectedUser
	return a.ExpectedError
}
