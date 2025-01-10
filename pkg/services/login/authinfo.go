package login

import (
	"context"
)

type AuthInfoService interface {
	GetAuthInfo(ctx context.Context, query *GetAuthInfoQuery) (*UserAuth, error)
	GetUserLabels(ctx context.Context, query GetUserLabelsQuery) (map[int64]string, error)
	SetAuthInfo(ctx context.Context, cmd *SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *UpdateAuthInfoCommand) error
	DeleteUserAuthInfo(ctx context.Context, userID int64) error
}

type Store interface {
	GetAuthInfo(ctx context.Context, query *GetAuthInfoQuery) (*UserAuth, error)
	GetUserLabels(ctx context.Context, query GetUserLabelsQuery) (map[int64]string, error)
	SetAuthInfo(ctx context.Context, cmd *SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *UpdateAuthInfoCommand) error
	DeleteUserAuthInfo(ctx context.Context, userID int64) error
}

const (
	// modules
	PasswordAuthModule  = "password"
	APIKeyAuthModule    = "apikey"
	SAMLAuthModule      = "auth.saml"
	LDAPAuthModule      = "ldap"
	AuthProxyAuthModule = "authproxy"
	JWTModule           = "jwt"
	ExtendedJWTModule   = "extendedjwt"
	RenderModule        = "render"
	// OAuth provider modules
	AzureADAuthModule    = "oauth_azuread"
	GoogleAuthModule     = "oauth_google"
	GitLabAuthModule     = "oauth_gitlab"
	GithubAuthModule     = "oauth_github"
	GenericOAuthModule   = "oauth_generic_oauth"
	GrafanaComAuthModule = "oauth_grafana_com"
	GrafanaNetAuthModule = "oauth_grafananet"
	OktaAuthModule       = "oauth_okta"

	// labels
	SAMLLabel = "SAML"
	LDAPLabel = "LDAP"
	JWTLabel  = "JWT"
	// OAuth provider labels
	AuthProxyLabel    = "Auth Proxy"
	AzureADLabel      = "AzureAD"
	GoogleLabel       = "Google"
	GenericOAuthLabel = "Generic OAuth"
	GitLabLabel       = "GitLab"
	GithubLabel       = "GitHub"
	GrafanaComLabel   = "grafana.com"
	OktaLabel         = "Okta"
)

// used for frontend to display a more user friendly label
func GetAuthProviderLabel(authModule string) string {
	switch authModule {
	case GithubAuthModule:
		return GithubLabel
	case GoogleAuthModule:
		return GoogleLabel
	case AzureADAuthModule:
		return AzureADLabel
	case GitLabAuthModule:
		return GitLabLabel
	case OktaAuthModule:
		return OktaLabel
	case GrafanaComAuthModule, GrafanaNetAuthModule:
		return GrafanaComLabel
	case SAMLAuthModule:
		return SAMLLabel
	case LDAPAuthModule, "": // FIXME: verify this situation doesn't exist anymore
		return LDAPLabel
	case JWTModule:
		return JWTLabel
	case AuthProxyAuthModule:
		return AuthProxyLabel
	case GenericOAuthModule:
		return GenericOAuthLabel
	default:
		return "Unknown"
	}
}
