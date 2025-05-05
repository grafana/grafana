package authinfotest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
)

type FakeService struct {
	login.AuthInfoService
	LatestUserID         int64
	ExpectedUserAuth     *login.UserAuth
	ExpectedExternalUser *login.ExternalUserInfo
	ExpectedError        error
	ExpectedLabels       map[int64]string

	SetAuthInfoFn        func(ctx context.Context, cmd *login.SetAuthInfoCommand) error
	UpdateAuthInfoFn     func(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error
	DeleteUserAuthInfoFn func(ctx context.Context, userID int64) error
}

func (a *FakeService) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	a.LatestUserID = query.UserId
	return a.ExpectedUserAuth, a.ExpectedError
}

func (a *FakeService) GetUserLabels(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	return a.ExpectedLabels, a.ExpectedError
}

func (a *FakeService) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	if a.SetAuthInfoFn != nil {
		return a.SetAuthInfoFn(ctx, cmd)
	}

	return a.ExpectedError
}

func (a *FakeService) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	if a.UpdateAuthInfoFn != nil {
		return a.UpdateAuthInfoFn(ctx, cmd)
	}

	return a.ExpectedError
}

func (a *FakeService) DeleteUserAuthInfo(ctx context.Context, userID int64) error {
	if a.DeleteUserAuthInfoFn != nil {
		return a.DeleteUserAuthInfoFn(ctx, userID)
	}

	return a.ExpectedError
}
