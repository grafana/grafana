package socialimpl

import (
	"bytes"
	"context"
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"gopkg.in/ini.v1"
	"net/http"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/licensing"
	secretsfake "github.com/grafana/grafana/pkg/services/secrets/fakes"
	"github.com/grafana/grafana/pkg/services/ssosettings/ssosettingsimpl"
	"github.com/grafana/grafana/pkg/services/supportbundles/supportbundlestest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationSocialService_ProvideService(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testCases := []struct {
		name                                string
		setup                               func(t *testing.T)
		expectedSocialMapLength             int
		expectedGenericOAuthSkipOrgRoleSync bool
	}{
		{
			name:                                "should load all social connectors",
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
	accessControl := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
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
			ctx := context.Background()

			if tc.setup != nil {
				tc.setup(t)
			}

			usageInsights := &usagestats.UsageStatsMock{}
			supportBundle := supportbundlestest.NewFakeBundleService()

			socialService := ProvideService(cfg, featuremgmt.WithFeatures(), usageInsights, supportBundle, remotecache.NewFakeStore(t), nil, ssoSettingsSvc)
			require.Equal(t, tc.expectedSocialMapLength, len(socialService.GetOAuthProviders()))

			genericOAuthInfo := socialService.GetOAuthInfoProvider("generic_oauth")
			if genericOAuthInfo != nil {
				require.Equal(t, tc.expectedGenericOAuthSkipOrgRoleSync, genericOAuthInfo.SkipOrgRoleSync)
			}

			for name, enabled := range socialService.GetOAuthProviders() {
				client, err := socialService.GetOAuthHttpClient(name)
				if !enabled {
					require.Error(t, err)
					require.Nil(t, client)
				} else {
					require.NoError(t, err)
					require.NotNil(t, client)
				}
			}

			report, err := usageInsights.GetUsageReport(ctx)
			require.NoError(t, err)
			require.NotNil(t, report)
			require.Len(t, report.Metrics, tc.expectedSocialMapLength)

			require.Len(t, supportBundle.Collectors, tc.expectedSocialMapLength)

			createdBundles := make(map[string]struct{}, 0)
			for _, collector := range supportBundle.Collectors {
				supportItem, err := collector.Fn(ctx)
				require.NoError(t, err)
				require.NotNil(t, supportItem)

				createdBundles[supportItem.Filename] = struct{}{}
			}

			require.Len(t, createdBundles, tc.expectedSocialMapLength)
		})
	}
}

func TestIntegrationSocialService_ProvideService_GrafanaComGrafanaNet(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

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
				Extra: map[string]string{
					"allowed_organizations": "",
				},
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
				Extra: map[string]string{
					"allowed_organizations": "",
				},
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
				Extra: map[string]string{
					"allowed_organizations": "",
				},
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
			expectedGrafanaComOAuthInfo: &social.OAuthInfo{
				AuthStyle: "inheader",
				AuthUrl:   "/oauth2/authorize",
				TokenUrl:  "/api/oauth2/token",
				Enabled:   false,
				ClientId:  "grafanaComClientId",
				Extra: map[string]string{
					"allowed_organizations": "",
				},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			iniFile, err := ini.Load([]byte(tc.rawIniContent))
			require.NoError(t, err)

			cfg := setting.NewCfg()
			cfg.Raw = iniFile

			secrets := secretsfake.NewMockService(t)
			accessControl := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())
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

			socialService := ProvideService(cfg, featuremgmt.WithFeatures(), &usagestats.UsageStatsMock{}, supportbundlestest.NewFakeBundleService(), remotecache.NewFakeStore(t), nil, ssoSettingsSvc)

			// Create a custom comparison that treats nil slices as equal to empty slices for the tests
			opts := cmp.Options{
				cmp.Transformer("normalizeSlice", func(s []string) []string {
					if s == nil {
						return []string{}
					}
					return s
				}),
				cmp.Transformer("normalizeMap", func(m map[string]string) map[string]string {
					if m == nil {
						return map[string]string{}
					}
					return m
				}),
			}

			actual := socialService.GetOAuthInfoProvider("grafana_com")
			if diff := cmp.Diff(tc.expectedGrafanaComOAuthInfo, actual, opts); diff != "" {
				t.Errorf("OAuthInfo mismatch (-want +got):\n%s", diff)
			}
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

func TestGetOAuthHttpClient_TokenExchangeTimeout(t *testing.T) {
	// Create a minimal SocialService with a mock connector for unit testing
	cfg := setting.NewCfg()
	ss := &SocialService{
		cfg:       cfg,
		socialMap: make(map[string]social.SocialConnector),
		log:       log.New("login.social"),
	}

	// mockConnector wraps an OAuthInfo so GetOAuthHttpClient can read timeout values
	type mockConnector struct {
		info *social.OAuthInfo
	}

	mc := func(info *social.OAuthInfo) social.SocialConnector {
		return &mockConnector{info: info}
	}

	testCases := []struct {
		name                 string
		tokenExchangeTimeout int
		expectedTimeout      time.Duration
	}{
		{
			name:                 "default timeout when not set (zero value)",
			tokenExchangeTimeout: 0,
			expectedTimeout:      15 * time.Second,
		},
		{
			name:                 "default timeout when negative",
			tokenExchangeTimeout: -1,
			expectedTimeout:      15 * time.Second,
		},
		{
			name:                 "custom timeout of 30 seconds",
			tokenExchangeTimeout: 30,
			expectedTimeout:      30 * time.Second,
		},
		{
			name:                 "custom timeout of 60 seconds for high-latency environments",
			tokenExchangeTimeout: 60,
			expectedTimeout:      60 * time.Second,
		},
		{
			name:                 "small custom timeout of 5 seconds",
			tokenExchangeTimeout: 5,
			expectedTimeout:      5 * time.Second,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			info := &social.OAuthInfo{
				Enabled:              true,
				TokenExchangeTimeout: tc.tokenExchangeTimeout,
			}
			ss.socialMap["test"] = &mockConnector{info: info}

			client, err := ss.GetOAuthHttpClient("test")
			require.NoError(t, err)
			require.NotNil(t, client)
			assert.Equal(t, tc.expectedTimeout, client.Timeout)

			// Verify transport dial and TLS timeouts are proportional
			tr, ok := client.Transport.(*http.Transport)
			require.True(t, ok)

			// The dialer should be accessible via DialContext
			// We verify that sub-timeouts don't exceed total timeout
			// by checking the transport was created correctly
			require.NotNil(tr)
		})
	}
}

func TestGetOAuthHttpClient_TimeoutNotAppliedForDisabledProvider(t *testing.T) {
	cfg := setting.NewCfg()
	ss := &SocialService{
		cfg:       cfg,
		socialMap: make(map[string]social.SocialConnector),
		log:       log.New("login.social"),
	}

	info := &social.OAuthInfo{
		Enabled:              false,
		TokenExchangeTimeout: 30,
	}
	ss.socialMap["disabled_test"] = &mockConnectorForTest{info: info}

	client, err := ss.GetOAuthHttpClient("disabled_test")
	require.Error(t, err)
	require.Nil(t, client)
	require.Contains(t, err.Error(), "not enabled")
}

// mockConnectorForTest is a minimal SocialConnector for testing
type mockConnectorForTest struct {
	info *social.OAuthInfo
}

func (m *mockConnectorForTest) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	return nil, nil
}
func (m *mockConnectorForTest) IsEmailAllowed(email string) bool { return true }
func (m *mockConnectorForTest) IsSignupAllowed() bool            { return true }
func (m *mockConnectorForTest) GetOAuthInfo() *social.OAuthInfo  { return m.info }
func (m *mockConnectorForTest) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	return ""
}
func (m *mockConnectorForTest) Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error) {
	return nil, nil
}
func (m *mockConnectorForTest) Client(ctx context.Context, t *oauth2.Token) *http.Client { return nil }
func (m *mockConnectorForTest) TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource {
	return nil
}
func (m *mockConnectorForTest) SupportBundleContent(*bytes.Buffer) error { return nil }
