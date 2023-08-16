package login

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestIsExternallySynced(t *testing.T) {
	testcases := []struct {
		name     string
		cfg      *setting.Cfg
		provider string
		expected bool
	}{
		// azure
		{
			name:     "AzureAD synced user should return that it is externally synced",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: false},
			provider: AzureADAuthModule,
			expected: true,
		},
		{
			name:     "AzureAD synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: true},
			provider: AzureADAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "azuread external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: AzureADAuthModule,
			expected: false,
		},
		// google
		{
			name:     "Google synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: false},
			provider: GoogleAuthModule,
			expected: true,
		},
		{
			name:     "Google synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: true},
			provider: GoogleAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "google external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GoogleAuthModule,
			expected: false,
		},
		{
			name:     "external user should return that it is not externally synced when oauth org role sync is set and google skip org role sync set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: true, OAuthSkipOrgRoleUpdateSync: true},
			provider: GoogleAuthModule,
			expected: false,
		},
		// okta
		{
			name:     "Okta synced user should return that it is externally synced",
			cfg:      &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: false},
			provider: OktaAuthModule,
			expected: true,
		},
		{
			name: "Okta synced user should return that it is not externally synced when org role sync is set",
			cfg:  &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: true},

			provider: OktaAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "okta external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: OktaAuthModule,
			expected: false,
		},
		// github
		{
			name:     "Github synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: false},
			provider: GithubAuthModule,
			expected: true,
		},
		{
			name:     "Github synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: true},
			provider: GithubAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "github external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GithubAuthModule,
			expected: false,
		},
		// gitlab
		{
			name:     "Gitlab synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: false},
			provider: GitLabAuthModule,
			expected: true,
		},
		{
			name:     "Gitlab synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: true},
			provider: GitLabAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "gitlab external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GitLabAuthModule,
			expected: false,
		},
		// grafana.com
		{
			name:     "Grafana.com synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: false},
			provider: GrafanaComAuthModule,
			expected: true,
		},
		{
			name:     "Grafana.com synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: true},
			provider: GrafanaComAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "grafanacom external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GrafanaComAuthModule,
			expected: false,
		},
		// generic oauth
		{
			name: "OAuth synced user should return that it is externally synced",
			cfg:  &setting.Cfg{GenericOAuthAuthEnabled: true, OAuthSkipOrgRoleUpdateSync: false},
			// this could be any of the external oauth providers
			provider: GenericOAuthModule,
			expected: true,
		},
		{
			name: "OAuth synced user should return that it is not externally synced when org role sync is set",
			cfg:  &setting.Cfg{GenericOAuthAuthEnabled: true, OAuthSkipOrgRoleUpdateSync: true},
			// this could be any of the external oauth providers
			provider: GenericOAuthModule,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "generic oauth external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GenericOAuthAuthEnabled: true, GenericOAuthSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GenericOAuthModule,
			expected: false,
		},
		// saml
		{
			name:     "SAML synced user should return that it is externally synced",
			cfg:      &setting.Cfg{SAMLAuthEnabled: true, SAMLSkipOrgRoleSync: false},
			provider: SAMLAuthModule,
			expected: true,
		},
		{
			name:     "SAML synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{SAMLAuthEnabled: true, SAMLSkipOrgRoleSync: true},
			provider: SAMLAuthModule,
			expected: false,
		},
		// ldap
		{
			name:     "LDAP synced user should return that it is externally synced",
			cfg:      &setting.Cfg{LDAPAuthEnabled: true, LDAPSkipOrgRoleSync: false},
			provider: LDAPAuthModule,
			expected: true,
		},
		{
			name:     "LDAP synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{LDAPAuthEnabled: true, LDAPSkipOrgRoleSync: true},
			provider: LDAPAuthModule,
			expected: false,
		},
		// jwt
		{
			name:     "JWT synced user should return that it is externally synced",
			cfg:      &setting.Cfg{JWTAuthEnabled: true, JWTAuthSkipOrgRoleSync: false},
			provider: JWTModule,
			expected: true,
		},
		{
			name:     "JWT synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{JWTAuthEnabled: true, JWTAuthSkipOrgRoleSync: true},
			provider: JWTModule,
			expected: false,
		},
		// IsProvider test
		{
			name:     "If no provider enabled should return false",
			cfg:      &setting.Cfg{JWTAuthSkipOrgRoleSync: true},
			provider: JWTModule,
			expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsExternallySynced(tc.cfg, tc.provider))
		})
	}
}

func TestIsProviderEnabled(t *testing.T) {
	testcases := []struct {
		name     string
		cfg      *setting.Cfg
		provider string
		expected bool
	}{
		// github
		{
			name:     "Github should return true if enabled",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true},
			provider: GithubAuthModule,
			expected: true,
		},
		{
			name:     "Github should return false if not enabled",
			cfg:      &setting.Cfg{},
			provider: GithubAuthModule,
			expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsProviderEnabled(tc.cfg, tc.provider))
		})
	}
}
