package strategies

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/setting"
)

var (
	iniContent = `
	[auth.generic_oauth]
	name = OAuth
	icon = signin
	enabled = true
	allow_sign_up = false
	auto_login = true
	client_id = test_client_id
	client_secret = test_client_secret
	scopes = openid, profile, email
	empty_scopes = false
	email_attribute_name = email:primary
	email_attribute_path = email
	login_attribute_path = login
	name_attribute_path = name
	role_attribute_path = role
	role_attribute_strict = true
	groups_attribute_path = groups
	id_token_attribute_name = id_token
	team_ids_attribute_path = team_ids
	auth_style = inheader
	auth_url = test_auth_url
	token_url = test_token_url
	api_url = test_api_url
	teams_url = test_teams_url
	allowed_domains = domain1.com
	allowed_groups =
	team_ids = first, second
	allowed_organizations = org1, org2
	tls_skip_verify_insecure = true
	tls_client_cert =
	tls_client_key =
	tls_client_ca =
	use_pkce = false
	allow_assign_grafana_admin = true
	skip_org_role_sync = true
	use_refresh_token = true
	empty_scopes =
	hosted_domain = test_hosted_domain
	signout_redirect_url = test_signout_redirect_url
	`

	expectedOAuthInfo = map[string]any{
		"name":                       "OAuth",
		"icon":                       "signin",
		"enabled":                    true,
		"allow_sign_up":              false,
		"auto_login":                 true,
		"client_id":                  "test_client_id",
		"client_secret":              "test_client_secret",
		"scopes":                     "openid, profile, email",
		"empty_scopes":               false,
		"email_attribute_name":       "email:primary",
		"email_attribute_path":       "email",
		"role_attribute_path":        "role",
		"role_attribute_strict":      true,
		"groups_attribute_path":      "groups",
		"team_ids_attribute_path":    "team_ids",
		"auth_url":                   "test_auth_url",
		"token_url":                  "test_token_url",
		"api_url":                    "test_api_url",
		"teams_url":                  "test_teams_url",
		"allowed_domains":            "domain1.com",
		"allowed_groups":             "",
		"tls_skip_verify_insecure":   true,
		"tls_client_cert":            "",
		"tls_client_key":             "",
		"tls_client_ca":              "",
		"use_pkce":                   false,
		"auth_style":                 "inheader",
		"allow_assign_grafana_admin": true,
		"use_refresh_token":          true,
		"hosted_domain":              "test_hosted_domain",
		"skip_org_role_sync":         true,
		"signout_redirect_url":       "test_signout_redirect_url",
		"allowed_organizations":      "org1, org2",
		"id_token_attribute_name":    "id_token",
		"login_attribute_path":       "login",
		"name_attribute_path":        "name",
		"team_ids":                   "first, second",
	}
)

func TestGetProviderConfig_EnvVarsOnly(t *testing.T) {
	setupEnvVars(t)

	cfg := setting.NewCfg()
	strategy := NewOAuthStrategy(cfg)

	result, err := strategy.GetProviderConfig(context.Background(), "generic_oauth")
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, result)
}

func TestGetProviderConfig_IniFileOnly(t *testing.T) {
	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	strategy := NewOAuthStrategy(cfg)

	result, err := strategy.GetProviderConfig(context.Background(), "generic_oauth")
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, result)
}

func TestGetProviderConfig_EnvVarsOverrideIniFileSettings(t *testing.T) {
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ENABLED", "false")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_SKIP_ORG_ROLE_SYNC", "false")

	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	strategy := NewOAuthStrategy(cfg)

	result, err := strategy.GetProviderConfig(context.Background(), "generic_oauth")
	require.NoError(t, err)

	expectedOAuthInfoWithOverrides := expectedOAuthInfo
	expectedOAuthInfoWithOverrides["enabled"] = false
	expectedOAuthInfoWithOverrides["skip_org_role_sync"] = false

	require.Equal(t, expectedOAuthInfoWithOverrides, result)
}

func setupEnvVars(t *testing.T) {
	t.Setenv("GF_AUTH_GENERIC_OAUTH_NAME", "OAuth")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ICON", "signin")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ENABLED", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ALLOW_SIGN_UP", "false")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_AUTO_LOGIN", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_CLIENT_ID", "test_client_id")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_CLIENT_SECRET", "test_client_secret")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_SCOPES", "openid, profile, email")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_EMPTY_SCOPES", "")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_EMAIL_ATTRIBUTE_NAME", "email:primary")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_EMAIL_ATTRIBUTE_PATH", "email")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_PATH", "role")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ROLE_ATTRIBUTE_STRICT", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_GROUPS_ATTRIBUTE_PATH", "groups")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TEAM_IDS_ATTRIBUTE_PATH", "team_ids")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_AUTH_URL", "test_auth_url")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TOKEN_URL", "test_token_url")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_API_URL", "test_api_url")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TEAMS_URL", "test_teams_url")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ALLOWED_DOMAINS", "domain1.com")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ALLOWED_GROUPS", "")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TLS_SKIP_VERIFY_INSECURE", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CERT", "")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_KEY", "")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TLS_CLIENT_CA", "")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_USE_PKCE", "false")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_AUTH_STYLE", "inheader")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ALLOW_ASSIGN_GRAFANA_ADMIN", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_SKIP_ORG_ROLE_SYNC", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_USE_REFRESH_TOKEN", "true")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_HOSTED_DOMAIN", "test_hosted_domain")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ALLOWED_ORGANIZATIONS", "org1, org2")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_ID_TOKEN_ATTRIBUTE_NAME", "id_token")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_LOGIN_ATTRIBUTE_PATH", "login")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_NAME_ATTRIBUTE_PATH", "name")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_TEAM_IDS", "first, second")
	t.Setenv("GF_AUTH_GENERIC_OAUTH_SIGNOUT_REDIRECT_URL", "test_signout_redirect_url")
}
