package oasimpl

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/user"
)

var cachedExternalService = func() *oauthserver.ExternalService {
	return &oauthserver.ExternalService{
		Name:             "my-ext-service",
		ClientID:         "RANDOMID",
		Secret:           "RANDOMSECRET",
		GrantTypes:       "client_credentials",
		PublicPem:        []byte("-----BEGIN PUBLIC KEY-----"),
		ServiceAccountID: 1,
		SelfPermissions:  []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
		SignedInUser: &user.SignedInUser{
			UserID: 2,
			OrgID:  1,
			Permissions: map[int64]map[string][]string{
				1: {
					"users:impersonate": {"users:*"},
				},
			},
		},
	}
}

func TestOAuth2ServiceImpl_GetPublicKeyScopes(t *testing.T) {
	testCases := []struct {
		name                   string
		initTestEnv            func(*TestEnv)
		impersonatePermissions []ac.Permission
		userID                 string
		expectedScopes         []string
		wantErr                bool
	}{
		{
			name: "should error out when GetExternalService returns error",
			initTestEnv: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound("my-ext-service"))
			},
			wantErr: true,
		},
		{
			name: "should error out when the user id cannot be parsed",
			initTestEnv: func(env *TestEnv) {
				env.S.cache.Set("my-ext-service", *cachedExternalService(), time.Minute)
			},
			userID:  "user:3",
			wantErr: true,
		},
		{
			name: "should return no scope when the external service is not allowed to impersonate the user",
			initTestEnv: func(env *TestEnv) {
				client := cachedExternalService()
				client.SignedInUser.Permissions = map[int64]map[string][]string{}
				env.S.cache.Set("my-ext-service", *client, time.Minute)
			},
			userID:         "user:id:3",
			expectedScopes: nil,
			wantErr:        false,
		},
		{
			name: "should return no scope when the external service has an no impersonate permission",
			initTestEnv: func(env *TestEnv) {
				client := cachedExternalService()
				client.ImpersonatePermissions = []ac.Permission{}
				env.S.cache.Set("my-ext-service", *client, time.Minute)
			},
			userID:         "user:id:3",
			expectedScopes: []string{},
			wantErr:        false,
		},
		{
			name: "should return the scopes when the external service has impersonate permissions",
			initTestEnv: func(env *TestEnv) {
				env.S.cache.Set("my-ext-service", *cachedExternalService(), time.Minute)
				client := cachedExternalService()
				client.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll},
					{Action: ac.ActionUsersRead, Scope: oauthserver.ScopeGlobalUsersSelf},
					{Action: ac.ActionUsersPermissionsRead, Scope: oauthserver.ScopeUsersSelf},
					{Action: ac.ActionTeamsRead, Scope: oauthserver.ScopeTeamsSelf}}
				env.S.cache.Set("my-ext-service", *client, time.Minute)
			},
			userID: "user:id:3",
			expectedScopes: []string{"users:impersonate",
				"profile", "email", ac.ActionUsersRead,
				"entitlements", ac.ActionUsersPermissionsRead,
				"groups", ac.ActionTeamsRead},
			wantErr: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tc.initTestEnv != nil {
				tc.initTestEnv(env)
			}

			scopes, err := env.S.GetPublicKeyScopes(context.Background(), "my-ext-service", tc.userID, "")
			if tc.wantErr {
				require.Error(t, err)
				return
			}

			require.EqualValues(t, tc.expectedScopes, scopes)
		})
	}
}
