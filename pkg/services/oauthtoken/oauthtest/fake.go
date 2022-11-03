package oauthtest

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/user"
	"golang.org/x/oauth2"
)

type FakeOAuthTokenService struct {
	passThruEnabled  bool
	ExpectedAuthUser *models.UserAuth
	ExpectedErrors   map[string]error
}

func (ts *FakeOAuthTokenService) GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token {
	return &oauth2.Token{
		AccessToken:  ts.ExpectedAuthUser.OAuthAccessToken,
		RefreshToken: ts.ExpectedAuthUser.OAuthRefreshToken,
		Expiry:       ts.ExpectedAuthUser.OAuthExpiry,
		TokenType:    ts.ExpectedAuthUser.OAuthTokenType,
	}
}

func (ts *FakeOAuthTokenService) IsOAuthPassThruEnabled(*datasources.DataSource) bool {
	return ts.passThruEnabled
}

func (ts *FakeOAuthTokenService) HasOAuthEntry(context.Context, *user.SignedInUser) (*models.UserAuth, bool, error) {
	if ts.ExpectedAuthUser != nil {
		return ts.ExpectedAuthUser, true, nil
	}
	if error, ok := ts.ExpectedErrors["HasOAuthEntry"]; ok {
		return nil, false, error
	}
	return nil, false, nil
}

func (ts *FakeOAuthTokenService) InvalidateOAuthTokens(ctx context.Context, usr *models.UserAuth) error {
	ts.ExpectedAuthUser.OAuthAccessToken = ""
	ts.ExpectedAuthUser.OAuthRefreshToken = ""
	ts.ExpectedAuthUser.OAuthExpiry = time.Time{}
	return nil
}

func (ts *FakeOAuthTokenService) TryTokenRefresh(ctx context.Context, usr *models.UserAuth) error {
	if err, ok := ts.ExpectedErrors["TryTokenRefresh"]; ok {
		return err
	}
	return nil
}
