package oauthtokentest

import (
	"context"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
)

// Service an OAuth token service suitable for tests.
type Service struct {
	Token *oauth2.Token
}

// ProvideService provides an OAuth token service suitable for tests.
func ProvideService() *Service {
	return &Service{}
}

func (s *Service) GetCurrentOAuthToken(context.Context, identity.Requester, *auth.UserToken) *oauth2.Token {
	return s.Token
}

func (s *Service) IsOAuthPassThruEnabled(ds *datasources.DataSource) bool {
	return oauthtoken.IsOAuthPassThruEnabled(ds)
}

func (s *Service) TryTokenRefresh(context.Context, identity.Requester, *auth.UserToken) (*oauth2.Token, error) {
	return s.Token, nil
}

func (s *Service) InvalidateOAuthTokens(context.Context, identity.Requester, *auth.UserToken) error {
	return nil
}
