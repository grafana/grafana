package login

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
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
	// OAuth provider modules
	AzureADAuthModule    = "oauth_azuread"
	GoogleAuthModule     = "oauth_google"
	GitLabAuthModule     = "oauth_gitlab"
	GithubAuthModule     = "oauth_github"
	GenericOAuthModule   = "oauth_generic_oauth"
	GrafanaComAuthModule = "oauth_grafana_com"
	GrafanaNetAuthModule = "oauth_grafananet"
	OktaAuthModule       = "oauth_okta"
)

const (
	// Auth provider labels
	AuthProxtLabel  = "Auth Proxy"
	AzureADLabel    = "AzureAD"
	GoogleLabel     = "Google"
	GenericOAuth    = "Generic OAuth"
	GitLabLabel     = "GitLab"
	GithubLabel     = "GitHub"
	GrafanaComLabel = "grafana.com"
	LDAPLabel       = "LDAP"
	OktaLabel       = "Okta"
	SAMLLabel       = "SAML"
	JWTLabel        = "JWT"
)

// User is allowed to change org role in the UI
// by not being synced with an external system
func IsExternallySynced(cfg *setting.Cfg, autoProviderLabel string) bool {
	// FIXME: remove this once we remove the setting
	// is a deprecated setting that is used to skip org role sync for all external oauth providers
	if cfg.OAuthSkipOrgRoleUpdateSync {
		return false
	}
	switch autoProviderLabel {
	case GoogleLabel:
		return !cfg.GoogleSkipOrgRoleSync
	case OktaLabel:
		// skip org role sync for Okta if the setting is set
		// means that the org role sync is handled by the Grafana
		return !cfg.OktaSkipOrgRoleSync
	}
	return true
}

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
		return AuthProxtLabel
	case GenericOAuthModule:
		return GenericOAuth
	default:
		return "Unknown"
	}
}
