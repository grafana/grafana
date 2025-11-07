package authinfotest

import (
	"context"

	"github.com/grafana/grafana/pkg/services/login"
)

type FakeService struct {
	login.AuthInfoService
	LatestUserID              int64
	ExpectedUserAuth          *login.UserAuth
	ExpectedExternalUser      *login.ExternalUserInfo
	ExpectedError             error
	ExpectedRecentlyUsedLabel map[int64]string
	ExpectedAuthModuleLabels  []string

	SetAuthInfoFn        func(ctx context.Context, cmd *login.SetAuthInfoCommand) error
	UpdateAuthInfoFn     func(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error
	DeleteUserAuthInfoFn func(ctx context.Context, userID int64) error
}

func (a *FakeService) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	a.LatestUserID = query.UserId
	return a.ExpectedUserAuth, a.ExpectedError
}

func (a *FakeService) GetUserRecentlyUsedLabel(ctx context.Context, query login.GetUserLabelsQuery) (map[int64]string, error) {
	return a.ExpectedRecentlyUsedLabel, a.ExpectedError
}

func (a *FakeService) GetUserAuthModuleLabels(ctx context.Context, userID int64) ([]string, error) {
	return a.ExpectedAuthModuleLabels, a.ExpectedError
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
