package oauthtokentest

import (
	"context"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
)

// Service an OAuth token service suitable for tests.
type Service struct {
	Token *oauth2.Token
}

// ProvideService provides an OAuth token service suitable for tests.
func ProvideService() *Service {
	return &Service{}
}

func (s *Service) GetCurrentOAuthToken(context.Context, *user.SignedInUser) *oauth2.Token {
	return s.Token
}

func (s *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return oauthtoken.IsOAuthPassThruEnabled(ds)
}

func (s *Service) HasOAuthEntry(context.Context, *user.SignedInUser) (*login.UserAuth, bool, error) {
	return nil, false, nil
}

func (s *Service) TryTokenRefresh(context.Context, *login.UserAuth) error {
	return nil
}

func (s *Service) InvalidateOAuthTokens(context.Context, *login.UserAuth) error {
	return nil
}
