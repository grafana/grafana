package oauthserver

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func setupTestEnv(t *testing.T) *ExternalService {
	t.Helper()

	client := &ExternalService{
		Name:             "my-ext-service",
		ClientID:         "RANDOMID",
		Secret:           "RANDOMSECRET",
		GrantTypes:       "client_credentials,urn:ietf:params:oauth:grant-type:jwt-bearer",
		ServiceAccountID: 2,
		SelfPermissions: []ac.Permission{
			{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll},
		},
		SignedInUser: &user.SignedInUser{
			UserID: 2,
			OrgID:  1,
		},
	}
	return client
}

func TestExternalService_GetScopesOnUser(t *testing.T) {
	testCases := []struct {
		name                   string
		impersonatePermissions []ac.Permission
		initTestEnv            func(*ExternalService)
		expectedScopes         []string
	}{
		{
			name:           "should return nil when the service account has no impersonate permissions",
			expectedScopes: nil,
		},
		{
			name: "should return the 'profile', 'email' and associated RBAC action",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						ac.ActionUsersImpersonate: {ac.ScopeUsersAll},
					},
				}
				c.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionUsersRead, Scope: ScopeGlobalUsersSelf},
				}
			},
			expectedScopes: []string{"profile", "email", ac.ActionUsersRead},
		},
		{
			name: "should return 'entitlements' and associated RBAC action scopes",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						ac.ActionUsersImpersonate: {ac.ScopeUsersAll},
					},
				}
				c.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionUsersPermissionsRead, Scope: ScopeUsersSelf},
				}
			},
			expectedScopes: []string{"entitlements", ac.ActionUsersPermissionsRead},
		},
		{
			name: "should return 'groups' and associated RBAC action scopes",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						ac.ActionUsersImpersonate: {ac.ScopeUsersAll},
					},
				}
				c.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionTeamsRead, Scope: ScopeTeamsSelf},
				}
			},
			expectedScopes: []string{"groups", ac.ActionTeamsRead},
		},
		{
			name: "should return all scopes",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						ac.ActionUsersImpersonate: {ac.ScopeUsersAll},
					},
				}
				c.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionUsersRead, Scope: ScopeGlobalUsersSelf},
					{Action: ac.ActionUsersPermissionsRead, Scope: ScopeUsersSelf},
					{Action: ac.ActionTeamsRead, Scope: ScopeTeamsSelf},
					{Action: dashboards.ActionDashboardsRead, Scope: dashboards.ScopeDashboardsAll},
				}
			},
			expectedScopes: []string{"profile", "email", ac.ActionUsersRead,
				"entitlements", ac.ActionUsersPermissionsRead,
				"groups", ac.ActionTeamsRead,
				"dashboards:read"},
		},
		{
			name: "should return stored scopes when the client's impersonate scopes has already been set",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						ac.ActionUsersImpersonate: {ac.ScopeUsersAll},
					},
				}
				c.ImpersonateScopes = []string{"dashboard:create", "profile", "email", "entitlements", "groups"}
			},
			expectedScopes: []string{"profile", "email", "entitlements", "groups", "dashboard:create"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c := setupTestEnv(t)
			if tc.initTestEnv != nil {
				tc.initTestEnv(c)
			}
			scopes := c.GetScopesOnUser(context.Background(), acimpl.ProvideAccessControl(setting.NewCfg()), 3)
			require.ElementsMatch(t, tc.expectedScopes, scopes)
		})
	}
}

func TestExternalService_GetScopes(t *testing.T) {
	testCases := []struct {
		name                   string
		impersonatePermissions []ac.Permission
		initTestEnv            func(*ExternalService)
		expectedScopes         []string
	}{
		{
			name: "should return default scopes when the signed in user is nil",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser = nil
			},
			expectedScopes: []string{"profile", "email", "entitlements", "groups"},
		},
		{
			name: "should return default scopes when the signed in user has no permissions",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{}
			},
			expectedScopes: []string{"profile", "email", "entitlements", "groups"},
		},
		{
			name: "should return additional scopes from signed in user's permissions",
			initTestEnv: func(c *ExternalService) {
				c.SignedInUser.Permissions = map[int64]map[string][]string{
					1: {
						dashboards.ActionDashboardsRead: {dashboards.ScopeDashboardsAll},
					},
				}
			},
			expectedScopes: []string{"profile", "email", "entitlements", "groups", "dashboards:read"},
		},
		{
			name: "should return stored scopes when the client's scopes has already been set",
			initTestEnv: func(c *ExternalService) {
				c.Scopes = []string{"profile", "email", "entitlements", "groups"}
			},
			expectedScopes: []string{"profile", "email", "entitlements", "groups"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			c := setupTestEnv(t)
			if tc.initTestEnv != nil {
				tc.initTestEnv(c)
			}
			scopes := c.GetScopes()
			require.ElementsMatch(t, tc.expectedScopes, scopes)
		})
	}
}

func TestExternalService_ToDTO(t *testing.T) {
	client := &ExternalService{
		ID:          1,
		Name:        "my-ext-service",
		ClientID:    "test",
		Secret:      "testsecret",
		RedirectURI: "http://localhost:3000",
		GrantTypes:  "client_credentials,urn:ietf:params:oauth:grant-type:jwt-bearer",
		Audiences:   "https://example.org,https://second.example.org",
		PublicPem:   []byte("pem_encoded_public_key"),
	}

	dto := client.ToDTO()

	require.Equal(t, client.ClientID, dto.ID)
	require.Equal(t, client.Name, dto.Name)
	require.Equal(t, client.RedirectURI, dto.RedirectURI)
	require.Equal(t, client.GrantTypes, dto.GrantTypes)
	require.Equal(t, client.Audiences, dto.Audiences)
	require.Equal(t, client.PublicPem, []byte(dto.KeyResult.PublicPem))
	require.Empty(t, dto.KeyResult.PrivatePem)
	require.Empty(t, dto.KeyResult.URL)
	require.False(t, dto.KeyResult.Generated)
	require.Equal(t, client.Secret, dto.Secret)
}
