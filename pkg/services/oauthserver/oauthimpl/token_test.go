package oauthimpl

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/ory/fosite"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"gopkg.in/square/go-jose.v2/jwt"
)

func TestOAuth2ServiceImpl_handleClientCredentials(t *testing.T) {
	client1 := &oauthserver.Client{
		ExternalServiceName: "testapp",
		ClientID:            "RANDOMID",
		GrantTypes:          string(fosite.GrantTypeClientCredentials),
		ServiceAccountID:    2,
		SignedInUser: &user.SignedInUser{
			UserID:  2,
			Name:    "Test App",
			Login:   "testapp",
			OrgRole: roletype.RoleViewer,
			Permissions: map[int64]map[string][]string{
				oauthserver.TmpOrgID: {
					"dashboards:read":  {"dashboards:*", "folders:*"},
					"dashboards:write": {"dashboards:uid:1"},
				},
			},
		},
	}

	tests := []struct {
		name           string
		scopes         []string
		client         *oauthserver.Client
		expectedClaims map[string]interface{}
		wantErr        bool
	}{
		{
			name: "no claim without client_credentials grant type",
			client: &oauthserver.Client{
				ExternalServiceName: "testapp",
				ClientID:            "RANDOMID",
				GrantTypes:          string(fosite.GrantTypeJWTBearer),
				ServiceAccountID:    2,
				SignedInUser:        &user.SignedInUser{},
			},
		},
		{
			name:   "no claims without scopes",
			client: client1,
		},
		{
			name:           "profile claims",
			client:         client1,
			scopes:         []string{"profile"},
			expectedClaims: map[string]interface{}{"name": "Test App", "login": "testapp"},
		},
		{
			name:   "email claims should be empty",
			client: client1,
			scopes: []string{"email"},
		},
		{
			name:   "groups claims should be empty",
			client: client1,
			scopes: []string{"groups"},
		},
		{
			name:   "entitlements claims",
			client: client1,
			scopes: []string{"entitlements"},
			expectedClaims: map[string]interface{}{"entitlements": map[string][]string{
				"dashboards:read":  {"dashboards:*", "folders:*"},
				"dashboards:write": {"dashboards:uid:1"},
			}},
		},
		{
			name:   "scoped entitlements claims",
			client: client1,
			scopes: []string{"entitlements", "dashboards:write"},
			expectedClaims: map[string]interface{}{"entitlements": map[string][]string{
				"dashboards:write": {"dashboards:uid:1"},
			}},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			env := setupTestEnv(t)
			session := &fosite.DefaultSession{}
			requester := fosite.NewAccessRequest(session)
			requester.GrantTypes = fosite.Arguments(strings.Split(tt.client.GrantTypes, ","))
			requester.RequestedScope = fosite.Arguments(tt.scopes)
			sessionData := NewPluginAuthSession("")
			err := env.S.handleClientCredentials(ctx, requester, sessionData, tt.client)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.expectedClaims == nil {
				require.Empty(t, sessionData.JWTClaims.Extra)
				return
			}
			require.Len(t, sessionData.JWTClaims.Extra, len(tt.expectedClaims))
			for k, v := range tt.expectedClaims {
				require.Equal(t, v, sessionData.JWTClaims.Extra[k])
			}
		})
	}
}

func TestOAuth2ServiceImpl_handleJWTBearer(t *testing.T) {
	now := time.Now()
	client1 := &oauthserver.Client{
		ExternalServiceName: "testapp",
		ClientID:            "RANDOMID",
		GrantTypes:          string(fosite.GrantTypeJWTBearer),
		ServiceAccountID:    2,
		SignedInUser: &user.SignedInUser{
			UserID:  2,
			OrgID:   oauthserver.TmpOrgID,
			Name:    "Test App",
			Login:   "testapp",
			OrgRole: roletype.RoleViewer,
			Permissions: map[int64]map[string][]string{
				oauthserver.TmpOrgID: {
					"users:impersonate": {"users:*"},
				},
			},
		},
	}
	user56 := &user.User{
		ID:      56,
		Email:   "user56@example.org",
		Login:   "user56",
		Name:    "User 56",
		Updated: now,
	}
	teams := []*team.TeamDTO{
		{ID: 1, Name: "Team 1", OrgID: 1},
		{ID: 2, Name: "Team 2", OrgID: 1},
	}
	client1WithPerm := func(perms []ac.Permission) *oauthserver.Client {
		client := *client1
		client.ImpersonatePermissions = perms
		return &client
	}

	tests := []struct {
		name           string
		initEnv        func(*TestEnv)
		scopes         []string
		client         *oauthserver.Client
		subject        string
		expectedClaims map[string]interface{}
		wantErr        bool
	}{
		{
			name: "no claim without jwtbearer grant type",
			client: &oauthserver.Client{
				ExternalServiceName: "testapp",
				ClientID:            "RANDOMID",
				GrantTypes:          string(fosite.GrantTypeClientCredentials),
				ServiceAccountID:    2,
			},
		},
		{
			name:    "err invalid subject",
			client:  client1,
			subject: "invalid_subject",
			wantErr: true,
		},
		{
			name: "err client is not allowed to impersonate",
			client: &oauthserver.Client{
				ExternalServiceName: "testapp",
				ClientID:            "RANDOMID",
				GrantTypes:          string(fosite.GrantTypeJWTBearer),
				ServiceAccountID:    2,
				SignedInUser: &user.SignedInUser{
					UserID:      2,
					Name:        "Test App",
					Login:       "testapp",
					OrgRole:     roletype.RoleViewer,
					Permissions: map[int64]map[string][]string{oauthserver.TmpOrgID: {}},
				},
			},
			subject: "user:id:56",
			wantErr: true,
		},
		{
			name: "err subject not found",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedError = user.ErrUserNotFound
			},
			client:  client1,
			subject: "user:id:56",
			wantErr: true,
		},
		{
			name: "no claim without scope",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
			},
			client:  client1,
			subject: "user:id:56",
		},
		{
			name: "profile claims",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
			},
			client:  client1,
			subject: "user:id:56",
			scopes:  []string{"profile"},
			expectedClaims: map[string]interface{}{
				"name":       "User 56",
				"login":      "user56",
				"updated_at": now.Unix(),
			},
		},
		{
			name: "email claim",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
			},
			client:  client1,
			subject: "user:id:56",
			scopes:  []string{"email"},
			expectedClaims: map[string]interface{}{
				"email": "user56@example.org",
			},
		},
		{
			name: "groups claim",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.TeamService.ExpectedTeamsByUser = teams
			},
			client:  client1,
			subject: "user:id:56",
			scopes:  []string{"groups"},
			expectedClaims: map[string]interface{}{
				"groups": []string{"Team 1", "Team 2"},
			},
		},
		{
			name: "no entitlement without any permission in the impersonate set",
			initEnv: func(env *TestEnv) {
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.UserService.ExpectedUser = user56
			},
			client:  client1,
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "no entitlement without permission intersection",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.AcStore.ExpectedUsersPermissions = map[int64][]ac.Permission{
					56: {{Action: "dashboards:read", Scope: "dashboards:uid:1"}},
				}
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "datasources:read", Scope: "datasources:*"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "entitlements contains only the intersection of permissions",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.AcStore.ExpectedUsersPermissions = map[int64][]ac.Permission{
					56: {
						{Action: "dashboards:read", Scope: "dashboards:uid:1"},
						{Action: "datasources:read", Scope: "datasources:uid:1"},
					},
				}
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "datasources:read", Scope: "datasources:*"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{
					"datasources:read": {"datasources:uid:1"},
				},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "entitlements have correctly translated users:self permissions",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.AcStore.ExpectedUsersPermissions = map[int64][]ac.Permission{
					56: {
						{Action: "users:read", Scope: "global.users:id:*"},
						{Action: "users.permissions:read", Scope: "users:id:*"},
					},
				}
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "users:read", Scope: "global.users:self"},
				{Action: "users.permissions:read", Scope: "users:self"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{
					"users:read":             {"global.users:id:56"},
					"users.permissions:read": {"users:id:56"},
				},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "entitlements have correctly translated teams:self permissions",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.TeamService.ExpectedTeamsByUser = teams
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.AcStore.ExpectedUsersPermissions = map[int64][]ac.Permission{
					56: {
						{Action: "teams:read", Scope: "teams:*"},
					},
				}
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "teams:read", Scope: "teams:self"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{
					"teams:read": {"teams:id:1", "teams:id:2"},
				},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "entitlements are correctly filtered based on scopes",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.TeamService.ExpectedTeamsByUser = teams
				env.AcStore.ExpectedUsersRoles = map[int64][]string{56: {"Viewer"}}
				env.AcStore.ExpectedUsersPermissions = map[int64][]ac.Permission{
					56: {
						{Action: "users:read", Scope: "global.users:id:*"},
						{Action: "datasources:read", Scope: "datasources:uid:1"},
					},
				}
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "users:read", Scope: "global.users:*"},
				{Action: "datasources:read", Scope: "datasources:*"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{
					"users:read": {"global.users:id:*"},
				},
			},
			scopes: []string{"entitlements", "users:read"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			env := setupTestEnv(t)
			session := &fosite.DefaultSession{}
			requester := fosite.NewAccessRequest(session)
			requester.GrantTypes = fosite.Arguments(strings.Split(tt.client.GrantTypes, ","))
			requester.RequestedScope = fosite.Arguments(tt.scopes)
			requester.GrantedScope = fosite.Arguments(tt.scopes)
			sessionData := NewPluginAuthSession("")
			sessionData.Subject = tt.subject

			if tt.initEnv != nil {
				tt.initEnv(env)
			}
			err := env.S.handleJWTBearer(ctx, requester, sessionData, tt.client)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			if tt.expectedClaims == nil {
				require.Empty(t, sessionData.JWTClaims.Extra)
				return
			}
			require.Len(t, sessionData.JWTClaims.Extra, len(tt.expectedClaims))
			for k, v := range tt.expectedClaims {
				require.Equal(t, v, sessionData.JWTClaims.Extra[k])
			}
		})
	}
}

type TokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

type Claims struct {
	jwt.Claims
	ClientID     string              `json:"client_id"`
	Groups       []string            `json:"groups"`
	Email        string              `json:"email"`
	Name         string              `json:"name"`
	Login        string              `json:"login"`
	Scopes       []string            `json:"scope"`
	Entitlements map[string][]string `json:"entitlements"`
}

func TestOAuth2ServiceImpl_HandleTokenRequest(t *testing.T) {
	client1Secret := "RANDOMSECRET"
	hashedSecret, err := bcrypt.GenerateFromPassword([]byte(client1Secret), bcrypt.DefaultCost)
	require.NoError(t, err)
	client1 := &oauthserver.Client{
		ExternalServiceName: "testapp",
		ClientID:            "RANDOMID",
		Secret:              string(hashedSecret),
		GrantTypes:          string(fosite.GrantTypeClientCredentials),
		ServiceAccountID:    2,
		ImpersonatePermissions: []ac.Permission{
			{Action: "folders:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
		SelfPermissions: []ac.Permission{
			{Action: "users:impersonate", Scope: "users:*"},
		},
	}
	sa1 := &serviceaccounts.ServiceAccountProfileDTO{
		Id:         client1.ServiceAccountID,
		Name:       "testapp",
		Login:      "testapp",
		OrgId:      oauthserver.TmpOrgID,
		IsDisabled: false,
		Created:    time.Now(),
		Updated:    time.Now(),
		Role:       "Viewer",
	}

	// user56 := &user.User{
	// 	ID:      56,
	// 	Email:   "user56@example.org",
	// 	Login:   "user56",
	// 	Name:    "User 56",
	// 	Updated: now,
	// }
	// teams := []*team.TeamDTO{
	// 	{ID: 1, Name: "Team 1", OrgID: 1},
	// 	{ID: 2, Name: "Team 2", OrgID: 1},
	// }

	tests := []struct {
		name       string
		initEnv    func(env *TestEnv)
		urlValues  url.Values
		wantCode   int
		wantScope  []string
		wantClaims *Claims
	}{
		{
			name: "client credentials grant",
			initEnv: func(env *TestEnv) {
				env.OAuthStore.On("GetExternalService", mock.Anything, client1.ClientID).Return(client1, nil)
				env.SAService.On("RetrieveServiceAccount", mock.Anything, oauthserver.TmpOrgID, client1.ServiceAccountID).Return(sa1, nil)
				env.AcStore.ExpectedUserPermissions = client1.SelfPermissions
			},
			urlValues: url.Values{
				"grant_type":    {"client_credentials"},
				"client_id":     {client1.ClientID},
				"client_secret": {client1Secret},
				"scope":         {"profile email groups entitlements"},
				"audience":      {"http://localhost:3000"},
			},
			wantCode:  http.StatusOK,
			wantScope: []string{"profile", "email", "groups", "entitlements"},
			wantClaims: &Claims{
				Claims: jwt.Claims{
					Subject:  "user:id:2", // From client1.ServiceAccountID
					Issuer:   "test",      // From env.S.Config.Issuer
					Audience: jwt.Audience{"http://localhost:3000"},
				},
				ClientID: client1.ClientID,
				Name:     "testapp",
				Login:    "testapp",
				// Scopes:       []string{"profile", "email", "groups", "entitlements"}, // TODO SHOULD WE ADD SCOPE TO THE JWT WITH CLIENT_CREDENTIALS?
				Entitlements: map[string][]string{
					"users:impersonate": {"users:*"},
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			if tt.initEnv != nil {
				tt.initEnv(env)
			}

			req := httptest.NewRequest("POST", "/oauth2/token", strings.NewReader(tt.urlValues.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

			resp := httptest.NewRecorder()

			env.S.HandleTokenRequest(resp, req)

			require.Equal(t, tt.wantCode, resp.Code)
			if tt.wantCode != http.StatusOK {
				return
			}

			body := resp.Body.Bytes()
			require.NotEmpty(t, body)

			var tokenResp TokenResponse
			require.NoError(t, json.Unmarshal(body, &tokenResp))

			// Check token response
			require.NotEmpty(t, tokenResp.Scope)
			require.ElementsMatch(t, tt.wantScope, strings.Split(tokenResp.Scope, " "))
			require.Positive(t, tokenResp.ExpiresIn)
			require.Equal(t, "bearer", tokenResp.TokenType)
			require.NotEmpty(t, tokenResp.AccessToken)

			// Check access token
			parsedToken, err := jwt.ParseSigned(tokenResp.AccessToken)
			require.NoError(t, err)
			require.Len(t, parsedToken.Headers, 1)
			typeHeader := parsedToken.Headers[0].ExtraHeaders["typ"]
			require.Equal(t, "at+jwt", strings.ToLower(typeHeader.(string)))
			require.Equal(t, "RS256", parsedToken.Headers[0].Algorithm)
			// Check access token claims
			var claims Claims
			require.NoError(t, parsedToken.Claims(pk.Public(), &claims))
			// Check times and remove them
			// TODO: Should we validate times?
			require.Positive(t, claims.IssuedAt.Time())
			require.Positive(t, claims.Expiry.Time())
			claims.IssuedAt = jwt.NewNumericDate(time.Time{})
			claims.Expiry = jwt.NewNumericDate(time.Time{})
			// Check the ID and remove it
			require.NotEmpty(t, claims.ID)
			claims.ID = ""
			// Compare the rest
			require.Equal(t, tt.wantClaims, &claims)
		})
	}
}
