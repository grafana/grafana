package socialtest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/login/social"
)

type FakeSocialService struct {
	ExpectedAuthInfoProvider *social.OAuthInfo
	ExpectedOAuthProviders   map[string]bool
	ExpectedConnector        social.SocialConnector
	ExpectedHttpClient       *http.Client
}

func (fss *FakeSocialService) GetOAuthProviders(context.Context) (map[string]bool, error) {
	return fss.ExpectedOAuthProviders, nil
}

func (fss *FakeSocialService) GetOAuthHttpClient(context.Context, string) (*http.Client, error) {
	return fss.ExpectedHttpClient, nil
}

func (fss *FakeSocialService) GetConnector(context.Context, string) (social.SocialConnector, error) {
	return fss.ExpectedConnector, nil
}

func (fss *FakeSocialService) GetOAuthInfoProvider(context.Context, string) (*social.OAuthInfo, error) {
	return fss.ExpectedAuthInfoProvider, nil
}

func (fss *FakeSocialService) GetOAuthInfoProviders(context.Context) (map[string]*social.OAuthInfo, error) {
	panic("not implemented")
}
