package oauthimpl

import (
	"context"
	"testing"
	"time"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

var cachedUser = func() *oauthserver.Client {
	return &oauthserver.Client{
		ExternalServiceName: "my-ext-service",
		ClientID:            "RANDOMID",
		Secret:              "RANDOMSECRET",
		GrantTypes:          "client_credentials",
		PublicPem:           []byte("-----BEGIN PUBLIC KEY-----"),
		ServiceAccountID:    1,
		SelfPermissions:     []ac.Permission{{Action: "users:impersonate", Scope: "users:*"}},
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
			name: "should return error when GetExternalService returns error",
			initTestEnv: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, mock.Anything).Return(nil, oauthserver.ErrClientNotFound("my-ext-service"))
			},
			wantErr: true,
		},
		{
			name: "should return error when the user id cannot be parsed",
			initTestEnv: func(env *TestEnv) {
				env.S.cache.Set("my-ext-service", *cachedUser(), time.Minute)
			},
			userID:  "user:3",
			wantErr: true,
		},
		{
			name: "should return error when the user does not have the impersonate permission",
			initTestEnv: func(env *TestEnv) {
				currentUser := cachedUser()
				currentUser.ImpersonatePermissions = []ac.Permission{}
				env.S.cache.Set("my-ext-service", *currentUser, time.Minute)
			},
			userID:         "user:id:3",
			expectedScopes: []string{},
			wantErr:        false,
		},
		{
			name: "should return the required scopes when the user has the impersonate permission",
			initTestEnv: func(env *TestEnv) {
				env.S.cache.Set("my-ext-service", *cachedUser(), time.Minute)
				currentUser := cachedUser()
				currentUser.ImpersonatePermissions = []ac.Permission{
					{Action: ac.ActionUsersImpersonate, Scope: ac.ScopeUsersAll},
					{Action: ac.ActionUsersRead, Scope: oauthserver.ScopeGlobalUsersSelf},
					{Action: ac.ActionUsersPermissionsRead, Scope: oauthserver.ScopeUsersSelf},
					{Action: ac.ActionTeamsRead, Scope: oauthserver.ScopeTeamsSelf}}
				env.S.cache.Set("my-ext-service", *currentUser, time.Minute)
			},
			userID:         "user:id:3",
			expectedScopes: []string{"users:impersonate", "profile", "email", "entitlements", "groups"},
			wantErr:        false,
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
