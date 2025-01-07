package socialimpl

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/authz/zanzana"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	secretsfake "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestSocialService_ProvideService(t *testing.T) {
	type testEnv struct {
		features featuremgmt.FeatureToggles
	}
	testCases := []struct {
		name                                string
		setup                               func(t *testing.T, env *testEnv)
		expectedSocialMapLength             int
		expectedGenericOAuthSkipOrgRoleSync bool
	}{
		{
			name:                                "should load only enabled social connectors when ssoSettingsApi is disabled",
			setup:                               nil,
			expectedSocialMapLength:             1,
			expectedGenericOAuthSkipOrgRoleSync: false,
		},
		{
			name: "should load all social connectors when ssoSettingsApi is enabled",
			setup: func(t *testing.T, env *testEnv) {
				env.features = featuremgmt.WithFeatures(featuremgmt.FlagSsoSettingsApi)
			},
			expectedSocialMapLength:             7,
			expectedGenericOAuthSkipOrgRoleSync: false,
		},
	}
	iniContent := `
	[auth.azuread]
	enabled = true
	skip_org_role_sync = true

	[auth.generic_oauth]
	enabled = false
	skip_org_role_sync = false
	`
	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.Raw = iniFile

	secrets := secretsfake.NewMockService(t)
	accessControl := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())
	sqlStore := db.InitTestDB(t)

	ssoSettingsSvc := ssosettingsimpl.ProvideService(
		cfg,
		sqlStore,
		accessControl,
		routing.NewRouteRegister(),
		featuremgmt.WithFeatures(),
		secrets,
		&usagestats.UsageStatsMock{},
		nil,
		&setting.OSSImpl{Cfg: cfg},
		&licensing.OSSLicensingService{},
	)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := &testEnv{
				features: featuremgmt.WithFeatures(),
			}
			if tc.setup != nil {
				tc.setup(t, env)
			}

			socialService := ProvideService(cfg, env.features, &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService(), remotecache.NewFakeStore(t), nil, ssoSettingsSvc)
			require.Equal(t, tc.expectedSocialMapLength, len(socialService.socialMap))

			genericOAuthInfo := socialService.GetOAuthInfoProvider("generic_oauth")
			if genericOAuthInfo != nil {
				require.Equal(t, tc.expectedGenericOAuthSkipOrgRoleSync, genericOAuthInfo.SkipOrgRoleSync)
			}
		})
	}
}

func TestSocialService_ProvideService_GrafanaComGrafanaNet(t *testing.T) {
	testCases := []struct {
		name                        string
		rawIniContent               string
		expectedGrafanaComOAuthInfo *social.OAuthInfo
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
			expectedGrafanaComOAuthInfo: &social.OAuthInfo{
				AuthStyle: "inheader",
				AuthUrl:   "/oauth2/authorize",
				TokenUrl:  "/api/oauth2/token",
				Enabled:   true,
				ClientId:  "grafanaComClientId",
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
			expectedGrafanaComOAuthInfo: &social.OAuthInfo{
				AuthStyle: "inheader",
				AuthUrl:   "/oauth2/authorize",
				TokenUrl:  "/api/oauth2/token",
				Enabled:   true,
				ClientId:  "grafanaNetClientId",
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
			expectedGrafanaComOAuthInfo: &social.OAuthInfo{
				AuthStyle: "inheader",
				AuthUrl:   "/oauth2/authorize",
				TokenUrl:  "/api/oauth2/token",
				Enabled:   true,
				ClientId:  "grafanaComClientId",
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
			expectedGrafanaComOAuthInfo: nil,
		},
	}

	cfg := setting.NewCfg()
	secrets := secretsfake.NewMockService(t)
	accessControl := acimpl.ProvideAccessControl(featuremgmt.WithFeatures(), zanzana.NewNoopClient())
	sqlStore := db.InitTestDB(t)

	ssoSettingsSvc := ssosettingsimpl.ProvideService(
		cfg,
		sqlStore,
		accessControl,
		routing.NewRouteRegister(),
		featuremgmt.WithFeatures(),
		secrets,
		&usagestats.UsageStatsMock{},
		nil,
		nil,
		&licensing.OSSLicensingService{},
	)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			iniFile, err := ini.Load([]byte(tc.rawIniContent))
			require.NoError(t, err)

			cfg := setting.NewCfg()
			cfg.Raw = iniFile

			socialService := ProvideService(cfg, featuremgmt.WithFeatures(), &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService(), remotecache.NewFakeStore(t), nil, ssoSettingsSvc)
			require.EqualValues(t, tc.expectedGrafanaComOAuthInfo, socialService.GetOAuthInfoProvider("grafana_com"))
		})
	}
}

func TestMapping_IniSectionOAuthInfo(t *testing.T) {
	iniContent := `
[test]
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
signout_redirect_url = https://oauth.com/signout?post_logout_redirect_uri=https://grafana.com
`

	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	expectedOAuthInfo := &social.OAuthInfo{
		Name:                        "OAuth",
		Icon:                        "signin",
		Enabled:                     true,
		AllowSignup:                 false,
		AutoLogin:                   true,
		ClientAuthentication:        "test_client_authentication",
		ClientId:                    "test_client_id",
		ClientSecret:                "test_client_secret",
		ManagedIdentityClientID:     "test_managed_identity_client_id",
		FederatedCredentialAudience: "test_federated_credential_audience",
		Scopes:                      []string{"openid", "profile", "email"},
		EmptyScopes:                 false,
		EmailAttributeName:          "email:primary",
		EmailAttributePath:          "email",
		RoleAttributePath:           "role",
		RoleAttributeStrict:         true,
		GroupsAttributePath:         "groups",
		TeamIdsAttributePath:        "team_ids",
		AuthUrl:                     "test_auth_url",
		TokenUrl:                    "test_token_url",
		ApiUrl:                      "test_api_url",
		TeamsUrl:                    "test_teams_url",
		AllowedDomains:              []string{"domain1.com"},
		AllowedGroups:               []string{},
		TlsSkipVerify:               true,
		TlsClientCert:               "",
		TlsClientKey:                "",
		TlsClientCa:                 "",
		UsePKCE:                     false,
		AuthStyle:                   "",
		AllowAssignGrafanaAdmin:     true,
		UseRefreshToken:             true,
		SkipOrgRoleSync:             true,
		HostedDomain:                "test_hosted_domain",
		SignoutRedirectUrl:          "https://oauth.com/signout?post_logout_redirect_uri=https://grafana.com",
		Extra: map[string]string{
			"allowed_organizations":   "org1, org2",
			"id_token_attribute_name": "id_token",
			"login_attribute_path":    "login",
			"name_attribute_path":     "name",
			"team_ids":                "first, second",
		},
	}

	settingsKVs := convertIniSectionToMap(iniFile.Section("test"))
	oauthInfo, err := connectors.CreateOAuthInfoFromKeyValues(settingsKVs)
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, oauthInfo)
}
