package oauthtokentest

import (
	"context"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
)

type MockOauthTokenService struct {
	GetCurrentOauthTokenFunc   func(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) *oauth2.Token
	IsOAuthPassThruEnabledFunc func(ds *datasources.DataSource) bool
	HasOAuthEntryFunc          func(ctx context.Context, usr identity.Requester) (*login.UserAuth, bool, error)
	InvalidateOAuthTokensFunc  func(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) error
	TryTokenRefreshFunc        func(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) (*oauth2.Token, error)
}

func (m *MockOauthTokenService) GetCurrentOAuthToken(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) *oauth2.Token {
	if m.GetCurrentOauthTokenFunc != nil {
		return m.GetCurrentOauthTokenFunc(ctx, usr, sessionToken)
	}
	return nil
}

func (m *MockOauthTokenService) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	if m.IsOAuthPassThruEnabledFunc != nil {
		return m.IsOAuthPassThruEnabledFunc(ds)
	}
	return false
}

func (m *MockOauthTokenService) HasOAuthEntry(ctx context.Context, usr identity.Requester) (*login.UserAuth, bool, error) {
	if m.HasOAuthEntryFunc != nil {
		return m.HasOAuthEntryFunc(ctx, usr)
	}
	return nil, false, nil
}

func (m *MockOauthTokenService) InvalidateOAuthTokens(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) error {
	if m.InvalidateOAuthTokensFunc != nil {
		return m.InvalidateOAuthTokensFunc(ctx, usr, sessionToken)
	}
	return nil
}

func (m *MockOauthTokenService) TryTokenRefresh(ctx context.Context, usr identity.Requester, sessionToken *auth.UserToken) (*oauth2.Token, error) {
	if m.TryTokenRefreshFunc != nil {
		return m.TryTokenRefreshFunc(ctx, usr, sessionToken)
	}
	return nil, nil
}
