package login

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

type AuthInfoService interface {
	LookupAndUpdate(ctx context.Context, query *GetUserByAuthInfoQuery) (*user.User, error)
	GetAuthInfo(ctx context.Context, query *GetAuthInfoQuery) error
	GetUserLabels(ctx context.Context, query GetUserLabelsQuery) (map[int64]string, error)
	GetExternalUserInfoByLogin(ctx context.Context, query *GetExternalUserInfoByLoginQuery) error
	SetAuthInfo(ctx context.Context, cmd *SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *UpdateAuthInfoCommand) error
	DeleteUserAuthInfo(ctx context.Context, userID int64) error
}

const (
	SAMLAuthModule      = "auth.saml"
	LDAPAuthModule      = "ldap"
	AuthProxyAuthModule = "authproxy"
	JWTModule           = "jwt"
	RenderModule        = "render"
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
	case "oauth_okta":
		return "Okta"
	case "oauth_grafana_com", "oauth_grafananet":
		return "grafana.com"
	case SAMLAuthModule:
		return "SAML"
	case LDAPAuthModule, "": // FIXME: verify this situation doesn't exist anymore
		return "LDAP"
	case JWTModule:
		return "JWT"
	case AuthProxyAuthModule:
		return "Auth Proxy"
	case "oauth_generic_oauth":
		return "Generic OAuth"
	default:
		return "Unknown"
	}
}
