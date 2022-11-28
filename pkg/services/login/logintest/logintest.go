package logintest

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LoginServiceFake struct{}

func (l *LoginServiceFake) CreateUser(cmd user.CreateUserCommand) (*user.User, error) {
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
	login.AuthInfoService
	LatestUserID         int64
	ExpectedUserAuth     *models.UserAuth
	ExpectedUser         *user.User
	ExpectedExternalUser *models.ExternalUserInfo
	ExpectedError        error
}

func (a *AuthInfoServiceFake) LookupAndUpdate(ctx context.Context, query *models.GetUserByAuthInfoQuery) (*user.User, error) {
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

func (a *AuthInfoServiceFake) GetUserLabels(ctx context.Context, query models.GetUserLabelsQuery) (map[int64]string, error) {
	return map[int64]string{int64(1): login.GetAuthProviderLabel(login.LDAPAuthModule)}, nil
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
	ExpectedUser  *user.User
	ExpectedError error
}

func (a *AuthenticatorFake) AuthenticateUser(c context.Context, query *models.LoginUserQuery) error {
	query.User = a.ExpectedUser
	return a.ExpectedError
}
