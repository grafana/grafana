package logintest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
)

type LoginServiceFake struct{}

func (l *LoginServiceFake) UpsertUser(ctx context.Context, cmd *login.UpsertUserCommand) (*user.User, error) {
	return nil, nil
}
func (l *LoginServiceFake) DisableExternalUser(ctx context.Context, username string) error {
	return nil
}
func (l *LoginServiceFake) SetTeamSyncFunc(login.TeamSyncFunc) {}

type AuthInfoServiceFake struct {
	login.AuthInfoService
	LatestUserID         int64
	ExpectedUserAuth     *login.UserAuth
	ExpectedUser         *user.User
	ExpectedExternalUser *login.ExternalUserInfo
	ExpectedError        error
	ExpectedLabels       map[int64]string

	SetAuthInfoFn    func(ctx context.Context, cmd *login.SetAuthInfoCommand) error
	UpdateAuthInfoFn func(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error
}

func (a *AuthInfoServiceFake) LookupAndUpdate(ctx context.Context, query *login.GetUserByAuthInfoQuery) (*user.User, error) {
	if query.UserLookupParams.UserID != nil {
		a.LatestUserID = *query.UserLookupParams.UserID
	} else {
		a.LatestUserID = 0
	}
	return a.ExpectedUser, a.ExpectedError
}

func (a *AuthInfoServiceFake) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	a.LatestUserID = query.UserId
	return a.ExpectedUserAuth, a.ExpectedError
}

func (a *AuthInfoServiceFake) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	return a.ExpectedLabels, a.ExpectedError
}

func (a *AuthInfoServiceFake) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	if a.SetAuthInfoFn != nil {
		return a.SetAuthInfoFn(ctx, cmd)
	}

	return a.ExpectedError
}

func (a *AuthInfoServiceFake) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	if a.UpdateAuthInfoFn != nil {
		return a.UpdateAuthInfoFn(ctx, cmd)
	}

	return a.ExpectedError
}

func (a *AuthInfoServiceFake) GetExternalUserInfoByLogin(ctx context.Context, query *login.GetExternalUserInfoByLoginQuery) (*login.ExternalUserInfo, error) {
	return a.ExpectedExternalUser, a.ExpectedError
}

func (a *AuthInfoServiceFake) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	return a.ExpectedError
}

type AuthenticatorFake struct {
	ExpectedUser  *user.User
	ExpectedError error
}

func (a *AuthenticatorFake) AuthenticateUser(c context.Context, query *login.LoginUserQuery) error {
	query.User = a.ExpectedUser
	return a.ExpectedError
}
