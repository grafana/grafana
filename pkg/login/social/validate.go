package social

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errEmptyClientId     = errutil.ValidationFailed("sso.emptyClientId", errutil.WithPublicMessage("settings.clientId cannot be empty"))
	errEmptyClientSecret = errutil.ValidationFailed("sso.emptyClientSecret", errutil.WithPublicMessage("settings.clientSecret cannot be empty"))
	errEmptyScopes       = errutil.ValidationFailed("sso.emptyScopes", errutil.WithPublicMessage("settings.scopes cannot be empty"))
)

func (o *OAuthInfo) ValidateForProvider(provider string) error {
	err := o.validateCommon()
	if err != nil {
		return err
	}

	switch provider {
	case AzureADProviderName:
		return o.validateForAzureAD()
	case GenericOAuthProviderName:
		return o.validateForGenericOAuth()
	case GitHubProviderName:
		return o.validateForGithub()
	case GitlabProviderName:
		return o.validateForGitlab()
	case GoogleProviderName:
		return o.validateForGoogle()
	case GrafanaComProviderName:
		return o.validateForGrafanaCom()
	case OktaProviderName:
		return o.validateForOkta()
	}

	return nil
}

func (o *OAuthInfo) validateForAzureAD() error {
	return nil
}

func (o *OAuthInfo) validateForGenericOAuth() error {
	return nil
}

func (o *OAuthInfo) validateForGithub() error {
	return nil
}

func (o *OAuthInfo) validateForGitlab() error {
	return nil
}

func (o *OAuthInfo) validateForGoogle() error {
	return nil
}

func (o *OAuthInfo) validateForGrafanaCom() error {
	return nil
}

func (o *OAuthInfo) validateForOkta() error {
	return nil
}

func (o *OAuthInfo) validateCommon() error {
	if o.ClientId == "" {
		return errEmptyClientId.Errorf("clientId is empty")
	}
	if o.ClientSecret == "" {
		return errEmptyClientSecret.Errorf("client secret is empty")
	}
	if len(o.Scopes) == 0 {
		return errEmptyScopes.Errorf("scopes slice is empty")
	}

	return nil
}
