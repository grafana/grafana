package social

import (
	"bytes"
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/login/social/models"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"golang.org/x/oauth2"
)

type Service interface {
	GetOAuthProviders() map[string]bool
	GetOAuthHttpClient(string) (*http.Client, error)
	GetConnector(string) (SocialConnector, error)
	GetOAuthInfoProvider(string) *models.OAuthInfo
	GetOAuthInfoProviders() map[string]*models.OAuthInfo
}

//go:generate mockery --name SocialConnector --structname MockSocialConnector --outpkg socialtest --filename social_connector_mock.go --output ./socialtest/
type SocialConnector interface {
	ssosettings.Reloadable
	UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*models.BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	GetOAuthInfo() *models.OAuthInfo

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
	TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource
	SupportBundleContent(*bytes.Buffer) error
}
