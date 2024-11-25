package login

import (
	"context"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/setting"
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
	PasswordAuthModule     = "password"
	PasswordlessAuthModule = "passwordless"
	APIKeyAuthModule       = "apikey"
	SAMLAuthModule         = "auth.saml"
	LDAPAuthModule         = "ldap"
	AuthProxyAuthModule    = "authproxy"
	JWTModule              = "jwt"
	ExtendedJWTModule      = "extendedjwt"
	RenderModule           = "render"
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

// IsExternnalySynced is used to tell if the user roles are externally synced
// true means that the org role sync is handled by Grafana
// Note: currently the users authinfo is overridden each time the user logs in
// https://github.com/grafana/grafana/blob/4181acec72f76df7ad02badce13769bae4a1f840/pkg/services/login/authinfoservice/database/database.go#L61
// this means that if the user has multiple auth providers and one of them is set to sync org roles
// then IsExternallySynced will be true for this one provider and false for the others
func IsExternallySynced(cfg *setting.Cfg, authModule string, oauthInfo *social.OAuthInfo) bool {
	// provider enabled in config
	if !IsProviderEnabled(cfg, authModule, oauthInfo) {
		return false
	}
	// first check SAML, LDAP and JWT
	switch authModule {
	case SAMLAuthModule:
		return !cfg.SAMLSkipOrgRoleSync
	case LDAPAuthModule:
		return !cfg.LDAPSkipOrgRoleSync
	case JWTModule:
		return !cfg.JWTAuth.SkipOrgRoleSync
	}
	switch authModule {
	case GoogleAuthModule, OktaAuthModule, AzureADAuthModule, GitLabAuthModule, GithubAuthModule, GrafanaComAuthModule, GenericOAuthModule:
		if oauthInfo == nil {
			return false
		}
		return !oauthInfo.SkipOrgRoleSync
	}
	return true
}

// IsGrafanaAdminExternallySynced returns true if Grafana server admin role is being managed by an external auth provider, and false otherwise.
// Grafana admin role sync is available for JWT, OAuth providers and LDAP.
// For JWT and OAuth providers there is an additional config option `allow_assign_grafana_admin` that has to be enabled for Grafana Admin role to be synced.
func IsGrafanaAdminExternallySynced(cfg *setting.Cfg, oauthInfo *social.OAuthInfo, authModule string) bool {
	if !IsExternallySynced(cfg, authModule, oauthInfo) {
		return false
	}

	switch authModule {
	case JWTModule:
		return cfg.JWTAuth.AllowAssignGrafanaAdmin
	case SAMLAuthModule:
		return cfg.SAMLRoleValuesGrafanaAdmin != ""
	case LDAPAuthModule:
		return true
	default:
		return oauthInfo != nil && oauthInfo.AllowAssignGrafanaAdmin
	}
}

func IsProviderEnabled(cfg *setting.Cfg, authModule string, oauthInfo *social.OAuthInfo) bool {
	switch authModule {
	case SAMLAuthModule:
		return cfg.SAMLAuthEnabled
	case LDAPAuthModule:
		return cfg.LDAPAuthEnabled
	case JWTModule:
		return cfg.JWTAuth.Enabled
	case GoogleAuthModule, OktaAuthModule, AzureADAuthModule, GitLabAuthModule, GithubAuthModule, GrafanaComAuthModule, GenericOAuthModule:
		if oauthInfo == nil {
			return false
		}
		return oauthInfo.Enabled
	}
	return false
}

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
