package strategies

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/login/social"
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
	client_authentication = test_client_authentication
	client_id = test_client_id
	client_secret = test_client_secret
	managed_identity_client_id = test_managed_identity_client_id
	federated_credential_audience = test_federated_credential_audience
	workload_identity_token_file = test_workload_identity_token_file
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
	org_attribute_path = groups
	org_mapping = Group1:*:Editor
	login_prompt = select_account
	`

	expectedOAuthInfo = map[string]any{
		"name":                          "OAuth",
		"icon":                          "signin",
		"enabled":                       true,
		"allow_sign_up":                 false,
		"auto_login":                    true,
		"client_authentication":         "test_client_authentication",
		"client_id":                     "test_client_id",
		"client_secret":                 "test_client_secret",
		"managed_identity_client_id":    "test_managed_identity_client_id",
		"federated_credential_audience": "test_federated_credential_audience",
		"workload_identity_token_file":  "test_workload_identity_token_file",
		"scopes":                        "openid, profile, email",
		"empty_scopes":                  false,
		"email_attribute_name":          "email:primary",
		"email_attribute_path":          "email",
		"role_attribute_path":           "role",
		"role_attribute_strict":         true,
		"groups_attribute_path":         "groups",
		"team_ids_attribute_path":       "team_ids",
		"auth_url":                      "test_auth_url",
		"token_url":                     "test_token_url",
		"api_url":                       "test_api_url",
		"teams_url":                     "test_teams_url",
		"allowed_domains":               "domain1.com",
		"allowed_groups":                "",
		"tls_skip_verify_insecure":      true,
		"tls_client_cert":               "",
		"tls_client_key":                "",
		"tls_client_ca":                 "",
		"use_pkce":                      false,
		"auth_style":                    "inheader",
		"allow_assign_grafana_admin":    true,
		"use_refresh_token":             true,
		"hosted_domain":                 "test_hosted_domain",
		"skip_org_role_sync":            true,
		"signout_redirect_url":          "test_signout_redirect_url",
		"allowed_organizations":         "org1, org2",
		"id_token_attribute_name":       "id_token",
		"login_attribute_path":          "login",
		"name_attribute_path":           "name",
		"team_ids":                      "first, second",
		"org_attribute_path":            "groups",
		"org_mapping":                   "Group1:*:Editor",
		"login_prompt":                  "select_account",
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
	workload_identity_token_file = azuread_token_file
	domain_hint = my-domain

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
	enabled = true
	allowed_organizations = org1, org2

	[auth.google]
	validate_hd = true
	`

	iniFile, err := ini.Load([]byte(iniWithExtraFields))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	strategy := NewOAuthStrategy(cfg)

	t.Run(social.AzureADProviderName, func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), social.AzureADProviderName)
		require.NoError(t, err)

		require.Equal(t, true, result["force_use_graph_api"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
		require.Equal(t, "azuread_token_file", result["workload_identity_token_file"])
		require.Equal(t, "my-domain", result["domain_hint"])
	})

	t.Run(social.GitHubProviderName, func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), social.GitHubProviderName)
		require.NoError(t, err)

		require.Equal(t, "first, second", result["team_ids"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
	})

	t.Run(social.GenericOAuthProviderName, func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), social.GenericOAuthProviderName)
		require.NoError(t, err)

		require.Equal(t, "first, second", result["team_ids"])
		require.Equal(t, "org1, org2", result["allowed_organizations"])
		require.Equal(t, "name", result["name_attribute_path"])
		require.Equal(t, "login", result["login_attribute_path"])
		require.Equal(t, "id_token", result["id_token_attribute_name"])
	})

	t.Run(social.GrafanaComProviderName, func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), social.GrafanaComProviderName)
		require.NoError(t, err)

		require.Equal(t, "org1, org2", result["allowed_organizations"])
	})

	t.Run(social.GoogleProviderName, func(t *testing.T) {
		result, err := strategy.GetProviderConfig(context.Background(), social.GoogleProviderName)
		require.NoError(t, err)

		require.Equal(t, true, result["validate_hd"])
	})
}

// TestGetProviderConfig_GrafanaComGrafanaNet tests that the connector is setup using the correct section and it supports
// the legacy settings for the provider (auth.grafananet section). The test cases are based on the current behavior of the
// SocialService's ProvideService method (TestSocialService_ProvideService_GrafanaComGrafanaNet).
func TestGetProviderConfig_GrafanaComGrafanaNet(t *testing.T) {
	testCases := []struct {
		name                       string
		rawIniContent              string
		expectedGrafanaComSettings map[string]any
	}{
		{
			name: "should setup the connector using auth.grafana_com section if it is enabled",
			rawIniContent: `
			[auth.grafana_com]
			enabled = true
			client_id = grafanaComClientId

			[auth.grafananet]
			enabled = false
			client_id = grafanaNetClientId`,
			expectedGrafanaComSettings: map[string]any{
				"enabled":   true,
				"client_id": "grafanaComClientId",
			},
		},
		{
			name: "should setup the connector using auth.grafananet section if it is enabled",
			rawIniContent: `
			[auth.grafana_com]
			enabled = false
			client_id = grafanaComClientId

			[auth.grafananet]
			enabled = true
			client_id = grafanaNetClientId`,
			expectedGrafanaComSettings: map[string]any{
				"enabled":   true,
				"client_id": "grafanaNetClientId",
			},
		},
		{
			name: "should setup the connector using auth.grafana_com section if both are enabled",
			rawIniContent: `
			[auth.grafana_com]
			enabled = true
			client_id = grafanaComClientId

			[auth.grafananet]
			enabled = true
			client_id = grafanaNetClientId`,
			expectedGrafanaComSettings: map[string]any{
				"enabled":   true,
				"client_id": "grafanaComClientId",
			},
		},
		{
			name: "should not setup the connector when both are disabled",
			rawIniContent: `
			[auth.grafana_com]
			enabled = false
			client_id = grafanaComClientId

			[auth.grafananet]
			enabled = false
			client_id = grafanaNetClientId`,
			expectedGrafanaComSettings: map[string]any{
				"enabled":   false,
				"client_id": "grafanaComClientId",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			iniFile, err := ini.Load([]byte(tc.rawIniContent))
			require.NoError(t, err)

			cfg := setting.NewCfg()
			cfg.Raw = iniFile

			strategy := NewOAuthStrategy(cfg)

			actualConfig, err := strategy.GetProviderConfig(context.Background(), "grafana_com")
			require.NoError(t, err)

			for key, value := range tc.expectedGrafanaComSettings {
				require.Equal(t, value, actualConfig[key], "Difference in key: %s. Expected: %v, got: %v", key, value, actualConfig[key])
			}
		})
	}
}
