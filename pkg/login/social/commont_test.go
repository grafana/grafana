package social

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestMapping_IniSectionOAuthInfo(t *testing.T) {
	iniContent := `
[test]
name = OAuth
icon = signin
enabled = true
allow_sign_up = false
auto_login = true
client_id = test_client_id
client_secret = test_client_secret
scopes = ["openid", "profile", "email"]
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
auth_style =
allow_assign_grafana_admin = true
skip_org_role_sync = true
use_refresh_token = true
empty_scopes =
hosted_domain = test_hosted_domain
`

	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	expectedOAuthInfo := &OAuthInfo{
		Name:                    "OAuth",
		Icon:                    "signin",
		Enabled:                 true,
		AllowSignup:             false,
		AutoLogin:               true,
		ClientId:                "test_client_id",
		ClientSecret:            "test_client_secret",
		Scopes:                  []string{"openid", "profile", "email"},
		EmptyScopes:             false,
		EmailAttributeName:      "email:primary",
		EmailAttributePath:      "email",
		RoleAttributePath:       "role",
		RoleAttributeStrict:     true,
		GroupsAttributePath:     "groups",
		TeamIdsAttributePath:    "team_ids",
		AuthUrl:                 "test_auth_url",
		TokenUrl:                "test_token_url",
		ApiUrl:                  "test_api_url",
		TeamsUrl:                "test_teams_url",
		AllowedDomains:          []string{"domain1.com"},
		AllowedGroups:           []string{},
		TlsSkipVerify:           true,
		TlsClientCert:           "",
		TlsClientKey:            "",
		TlsClientCa:             "",
		UsePKCE:                 false,
		AuthStyle:               "",
		AllowAssignGrafanaAdmin: true,
		UseRefreshToken:         true,
		HostedDomain:            "test_hosted_domain",
		Extra: map[string]string{
			"allowed_organizations":   "org1, org2",
			"id_token_attribute_name": "id_token",
			"login_attribute_path":    "login",
			"name_attribute_path":     "name",
			"skip_org_role_sync":      "true",
			"team_ids":                "first, second",
		},
	}

	settingsKVs := convertIniSectionToMap(iniFile.Section("test"))
	oauthInfo, err := CreateOAuthInfoFromKeyValues(settingsKVs)
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, oauthInfo)
}
