package socialtest

import (
	"net/http"

	"github.com/grafana/grafana/pkg/login/social"
)

type FakeSocialService struct {
	ExpectedAuthInfoProvider *social.OAuthInfo
	ExpectedOAuthProviders   map[string]bool
	ExpectedConnector        social.SocialConnector
	ExpectedHttpClient       *http.Client
}

func (fss *FakeSocialService) GetOAuthProviders() map[string]bool {
	return fss.ExpectedOAuthProviders
}

func (fss *FakeSocialService) GetOAuthHttpClient(string) (*http.Client, error) {
	return fss.ExpectedHttpClient, nil
}

func (fss *FakeSocialService) GetConnector(string) (social.SocialConnector, error) {
	return fss.ExpectedConnector, nil
}

func (fss *FakeSocialService) GetOAuthInfoProvider(string) *social.OAuthInfo {
	return fss.ExpectedAuthInfoProvider
}

func (fss *FakeSocialService) GetOAuthInfoProviders() map[string]*social.OAuthInfo {
	panic("not implemented")
}
