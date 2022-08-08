package login

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/user"
)

type AuthInfoService interface {
	LookupAndUpdate(ctx context.Context, query *models.GetUserByAuthInfoQuery) (*user.User, error)
	GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error
	GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error
	SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error
}

const (
	SAMLAuthModule      = "auth.saml"
	LDAPAuthModule      = "ldap"
	AuthProxyAuthModule = "authproxy"
)

func GetAuthProviderLabel(authModule string) string {
	switch authModule {
	case "oauth_github":
		return "GitHub"
	case "oauth_google":
		return "Google"
	case "oauth_azuread":
		return "AzureAD"
	case "oauth_gitlab":
		return "GitLab"
	case "oauth_grafana_com", "oauth_grafananet":
		return "grafana.com"
	case SAMLAuthModule:
		return "SAML"
	case LDAPAuthModule, "": // FIXME: verify this situation doesn't exist anymore
		return "LDAP"
	case "jwt":
		return "JWT"
	case AuthProxyAuthModule:
		return "Auth Proxy"
	default:
		return "OAuth" // FIXME: replace with "Unknown" and handle generic oauth as a case
	}
}
