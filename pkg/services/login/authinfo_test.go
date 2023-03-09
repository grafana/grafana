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
		{
			name:     "AzureAD synced user should return that it is externally synced",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: false},
			provider: AzureADLabel,
			expected: true,
		},
		{
			name:     "AzureAD synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: true},
			provider: AzureADLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "azuread external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{AzureADEnabled: true, AzureADSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: AzureADLabel,
			expected: false,
		},
		{
			name:     "Google synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: false},
			provider: GoogleLabel,
			expected: true,
		},
		{
			name:     "Google synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: true},
			provider: GoogleLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "google external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GoogleLabel,
			expected: false,
		},
		{
			name:     "external user should return that it is not externally synced when oauth org role sync is set and google skip org role sync set",
			cfg:      &setting.Cfg{GoogleAuthEnabled: true, GoogleSkipOrgRoleSync: true, OAuthSkipOrgRoleUpdateSync: true},
			provider: GoogleLabel,
			expected: false,
		},
		{
			name:     "Okta synced user should return that it is externally synced",
			cfg:      &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: false},
			provider: OktaLabel,
			expected: true,
		},
		{
			name: "Okta synced user should return that it is not externally synced when org role sync is set",
			cfg:  &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: true},

			provider: OktaLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "okta external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{OktaAuthEnabled: true, OktaSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: OktaLabel,
			expected: false,
		},
		{
			name:     "Github synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: false},
			provider: GithubLabel,
			expected: true,
		},
		{
			name:     "Github synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: true},
			provider: GithubLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "github external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GitHubAuthEnabled: true, GitHubSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GithubLabel,
			expected: false,
		},
		// gitlab
		{
			name:     "Gitlab synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: false},
			provider: GitLabLabel,
			expected: true,
		},
		{
			name:     "Gitlab synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: true},
			provider: GitLabLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "gitlab external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GitLabAuthEnabled: true, GitLabSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GitLabLabel,
			expected: false,
		},
		// grafana.com
		{
			name:     "Grafana.com synced user should return that it is externally synced",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: false},
			provider: GrafanaComLabel,
			expected: true,
		},
		{
			name:     "Grafana.com synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: true},
			provider: GrafanaComLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "grafanacom external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GrafanaComAuthEnabled: true, GrafanaComSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GrafanaComLabel,
			expected: false,
		},
		{
			name: "OAuth synced user should return that it is externally synced",
			cfg:  &setting.Cfg{GenericOAuthAuthEnabled: true, OAuthSkipOrgRoleUpdateSync: false},
			// this could be any of the external oauth providers
			provider: GenericOAuthLabel,
			expected: true,
		},
		{
			name: "OAuth synced user should return that it is not externally synced when org role sync is set",
			cfg:  &setting.Cfg{GenericOAuthAuthEnabled: true, OAuthSkipOrgRoleUpdateSync: true},
			// this could be any of the external oauth providers
			provider: GenericOAuthLabel,
			expected: false,
		},
		// FIXME: remove this test as soon as we remove the deprecated setting for skipping org role sync for all external oauth providers
		{
			name:     "generic oauth external user should return that it is not externally synced when oauth org role sync is set",
			cfg:      &setting.Cfg{GenericOAuthAuthEnabled: true, GenericOAuthSkipOrgRoleSync: false, OAuthSkipOrgRoleUpdateSync: true},
			provider: GenericOAuthLabel,
			expected: false,
		},
		{
			name:     "SAML synced user should return that it is externally synced",
			cfg:      &setting.Cfg{SAMLAuthEnabled: true, SAMLSkipOrgRoleSync: false},
			provider: SAMLLabel,
			expected: true,
		},
		{
			name:     "SAML synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{SAMLAuthEnabled: true, SAMLSkipOrgRoleSync: true},
			provider: SAMLLabel,
			expected: false,
		},
		{
			name:     "LDAP synced user should return that it is externally synced",
			cfg:      &setting.Cfg{LDAPAuthEnabled: true, LDAPSkipOrgRoleSync: false},
			provider: LDAPLabel,
			expected: true,
		},
		{
			name:     "LDAP synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{LDAPAuthEnabled: true, LDAPSkipOrgRoleSync: true},
			provider: LDAPLabel,
			expected: false,
		},
		{
			name:     "JWT synced user should return that it is externally synced",
			cfg:      &setting.Cfg{JWTAuthEnabled: true, JWTAuthSkipOrgRoleSync: false},
			provider: JWTLabel,
			expected: true,
		},
		{
			name:     "JWT synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{JWTAuthEnabled: true, JWTAuthSkipOrgRoleSync: true},
			provider: JWTLabel,
			expected: false,
		},
		// this test could be for any provider
		{
			name:     "If no provider enabled should return false",
			cfg:      &setting.Cfg{JWTAuthSkipOrgRoleSync: true},
			provider: JWTLabel,
			expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsExternallySynced(tc.cfg, tc.provider))
		})
	}
}
