package socialtest

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/login/social"
)

type FakeSocialService struct {
	ExpectedAuthInfoProvider      *social.OAuthInfo
	ExpectedAuthInfoProviderError error
	ExpectedOAuthProviders        map[string]bool
	ExpectedOAuthProvidersError   error
	ExpectedConnector             social.SocialConnector
	ExpectedHttpClient            *http.Client
	GetOAuthInfoProviderFunc      func(context.Context, string) (*social.OAuthInfo, error)
	GetOAuthInfoProvidersFunc     func(context.Context) (map[string]*social.OAuthInfo, error)
}

func (fss *FakeSocialService) GetOAuthProviders(context.Context) (map[string]bool, error) {
	return fss.ExpectedOAuthProviders, fss.ExpectedOAuthProvidersError
}

func (fss *FakeSocialService) GetOAuthHttpClient(context.Context, string) (*http.Client, error) {
	return fss.ExpectedHttpClient, nil
}

func (fss *FakeSocialService) GetConnector(context.Context, string) (social.SocialConnector, error) {
	return fss.ExpectedConnector, nil
}

func (fss *FakeSocialService) GetOAuthInfoProvider(ctx context.Context, provider string) (*social.OAuthInfo, error) {
	if fss.GetOAuthInfoProviderFunc != nil {
		return fss.GetOAuthInfoProviderFunc(ctx, provider)
	}
	return fss.ExpectedAuthInfoProvider, fss.ExpectedAuthInfoProviderError
}

func (fss *FakeSocialService) GetOAuthInfoProviders(ctx context.Context) (map[string]*social.OAuthInfo, error) {
	if fss.GetOAuthInfoProvidersFunc != nil {
		return fss.GetOAuthInfoProvidersFunc(ctx)
	}
	panic("not implemented")
}
