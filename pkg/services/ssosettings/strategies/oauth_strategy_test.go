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

func TestGetProviderConfig(t *testing.T) {
	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	strategy := NewOAuthStrategy(cfg)

	result, err := strategy.GetProviderConfig(context.Background(), "generic_oauth")
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, result)
}

func TestGetProviderConfig_ExtraFields(t *testing.T) {
	iniWithExtraFields := `
	[auth.azuread]
	force_use_graph_api = true
	allowed_organizations = org1, org2

	[auth.github]
	team_ids = first, second
	allowed_organizations = org1, org2

	[auth.generic_oauth]
	name_attribute_path = name
	login_attribute_path = login
	id_token_attribute_name = id_token
	team_ids = first, second
	allowed_organizations = org1, org2

	[auth.grafana_com]
	allowed_organizations = org1, org2
	`

	iniFile, err := ini.Load([]byte(iniWithExtraFields))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	strategy := NewOAuthStrategy(cfg)

	t.Run("azuread", func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), "azuread")
		require.NoError(t, err)

		require.Equal(t, "true", result["force_use_graph_api"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
	})

	t.Run("github", func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), "github")
		require.NoError(t, err)

		require.Equal(t, "first, second", result["team_ids"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
	})

	t.Run("generic_oauth", func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), "generic_oauth")
		require.NoError(t, err)

		require.Equal(t, "first, second", result["team_ids"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
		require.Equal(t, "name", result["name_attribute_path"])
		require.Equal(t, "login", result["login_attribute_path"])
		require.Equal(t, "id_token", result["id_token_attribute_name"])
	})

	t.Run("grafana_com", func(t *testing.T) {
		t.Skip("Skipping to revert an issue.")
		result, err := strategy.GetProviderConfig(context.Background(), "grafana_com")
		require.NoError(t, err)

		require.Equal(t, "org1, org2", result["allowed_organizations"])
	})
}
