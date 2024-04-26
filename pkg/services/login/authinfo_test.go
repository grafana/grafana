package login

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/setting"
)

func TestIsExternallySynced(t *testing.T) {
	testcases := []struct {
		name      string
		cfg       *setting.Cfg
		oauthInfo *social.OAuthInfo
		provider  string
		expected  bool
	}{
		// Same for all of the OAuth providers
		{
			name:      "AzureAD external user should return that it is externally synced",
			cfg:       &setting.Cfg{},
			oauthInfo: &social.OAuthInfo{Enabled: true, SkipOrgRoleSync: false},
			provider:  AzureADAuthModule,
			expected:  true,
		},
		{
			name:      "AzureAD external user should return that it is not externally synced when org role sync is set",
			cfg:       &setting.Cfg{},
			oauthInfo: &social.OAuthInfo{Enabled: true, SkipOrgRoleSync: true},
			provider:  AzureADAuthModule,
			expected:  false,
		},
		{
			name:      "AzureAD external user should return that it is not externally synced when the provider is not enabled",
			cfg:       &setting.Cfg{},
			oauthInfo: &social.OAuthInfo{Enabled: false, SkipOrgRoleSync: false},
			provider:  AzureADAuthModule,
			expected:  false,
		},
		{
			name:      "AzureAD synced user should return that it is not externally synced when the provider is not enabled and nil",
			cfg:       &setting.Cfg{},
			oauthInfo: nil,
			provider:  AzureADAuthModule,
			expected:  false,
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
			cfg:      &setting.Cfg{JWTAuth: setting.AuthJWTSettings{Enabled: true, SkipOrgRoleSync: false}},
			provider: JWTModule,
			expected: true,
		},
		{
			name:     "JWT synced user should return that it is not externally synced when org role sync is set",
			cfg:      &setting.Cfg{JWTAuth: setting.AuthJWTSettings{Enabled: true, SkipOrgRoleSync: true}},
			provider: JWTModule,
			expected: false,
		},
		// IsProvider test
		{
			name:     "If no provider enabled should return false",
			cfg:      &setting.Cfg{JWTAuth: setting.AuthJWTSettings{Enabled: false, SkipOrgRoleSync: true}},
			provider: JWTModule,
			expected: false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsExternallySynced(tc.cfg, tc.provider, tc.oauthInfo))
		})
	}
}

func TestIsProviderEnabled(t *testing.T) {
	testcases := []struct {
		name      string
		oauthInfo *social.OAuthInfo
		provider  string
		expected  bool
	}{
		// github
		{
			name:      "Github should return true if enabled",
			oauthInfo: &social.OAuthInfo{Enabled: true},
			provider:  GithubAuthModule,
			expected:  true,
		},
		{
			name:      "Github should return false if not enabled",
			oauthInfo: &social.OAuthInfo{Enabled: false},
			provider:  GithubAuthModule,
			expected:  false,
		},
	}

	for _, tc := range testcases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, IsProviderEnabled(setting.NewCfg(), tc.provider, tc.oauthInfo))
		})
	}
}
