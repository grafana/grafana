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

type Store interface {
	GetExternalUserInfoByLogin(ctx context.Context, query *GetExternalUserInfoByLoginQuery) error
	GetAuthInfo(ctx context.Context, query *GetAuthInfoQuery) error
	GetUserLabels(ctx context.Context, query GetUserLabelsQuery) (map[int64]string, error)
	SetAuthInfo(ctx context.Context, cmd *SetAuthInfoCommand) error
	UpdateAuthInfo(ctx context.Context, cmd *UpdateAuthInfoCommand) error
	UpdateAuthInfoDate(ctx context.Context, authInfo *UserAuth) error
	DeleteAuthInfo(ctx context.Context, cmd *DeleteAuthInfoCommand) error
	DeleteUserAuthInfo(ctx context.Context, userID int64) error
	GetUserById(ctx context.Context, id int64) (*user.User, error)
	GetUserByLogin(ctx context.Context, login string) (*user.User, error)
	GetUserByEmail(ctx context.Context, email string) (*user.User, error)
	CollectLoginStats(ctx context.Context) (map[string]interface{}, error)
	RunMetricsCollection(ctx context.Context) error
	GetLoginStats(ctx context.Context) (LoginStats, error)
}

const (
	// modules
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

	// labels
	SAMLLabel = "SAML"
	LDAPLabel = "LDAP"
	JWTLabel  = "JWT"
	// OAuth provider labels
	AuthProxtLabel    = "Auth Proxy"
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
func IsExternallySynced(cfg *setting.Cfg, autoProviderLabel string) bool {
	// first check SAML, LDAP and JWT
	switch autoProviderLabel {
	case SAMLLabel:
		return !cfg.SAMLSkipOrgRoleSync
	case LDAPLabel:
		return !cfg.LDAPSkipOrgRoleSync
	case JWTLabel:
		return !cfg.JWTAuthSkipOrgRoleSync
	}
	// then check the rest of the oauth providers
	// FIXME: remove this once we remove the setting
	// is a deprecated setting that is used to skip org role sync for all external oauth providers
	if cfg.OAuthSkipOrgRoleUpdateSync {
		return false
	}
	switch autoProviderLabel {
	case GoogleLabel:
		return !cfg.GoogleSkipOrgRoleSync
	case OktaLabel:
		return !cfg.OktaSkipOrgRoleSync
	case AzureADLabel:
		return !cfg.AzureADSkipOrgRoleSync
	case GitLabLabel:
		return !cfg.GitLabSkipOrgRoleSync
	case GithubLabel:
		return !cfg.GithubSkipOrgRoleSync
	case GrafanaComLabel:
		return !cfg.GrafanaComSkipOrgRoleSync
	case GenericOAuthLabel:
		return !cfg.GenericOAuthSkipOrgRoleSync
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
		return GenericOAuthLabel
	default:
		return "Unknown"
	}
}
