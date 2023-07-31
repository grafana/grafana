package oasimpl

import (
	"context"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/ory/fosite"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/exp/maps"
	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"

	"github.com/grafana/grafana/pkg/models/roletype"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/oauthserver"
	"github.com/grafana/grafana/pkg/services/serviceaccounts"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestOAuth2ServiceImpl_handleClientCredentials(t *testing.T) {
	client1 := &oauthserver.ExternalService{
		Name:             "testapp",
		ClientID:         "RANDOMID",
		GrantTypes:       string(fosite.GrantTypeClientCredentials),
		ServiceAccountID: 2,
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
		client         *oauthserver.ExternalService
		expectedClaims map[string]interface{}
		wantErr        bool
	}{
		{
			name: "no claim without client_credentials grant type",
			client: &oauthserver.ExternalService{
				Name:             "testapp",
				ClientID:         "RANDOMID",
				GrantTypes:       string(fosite.GrantTypeJWTBearer),
				ServiceAccountID: 2,
				SignedInUser:     &user.SignedInUser{},
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
			sessionData := NewAuthSession()
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
			for claimsKey, claimsValue := range tt.expectedClaims {
				switch expected := claimsValue.(type) {
				case []string:
					require.ElementsMatch(t, claimsValue, sessionData.JWTClaims.Extra[claimsKey])
				case map[string][]string:
					actual, ok := sessionData.JWTClaims.Extra[claimsKey].(map[string][]string)
					require.True(t, ok, "expected map[string][]string")

					require.ElementsMatch(t, maps.Keys(expected), maps.Keys(actual))
					for expKey, expValue := range expected {
						require.ElementsMatch(t, expValue, actual[expKey])
					}
				default:
					require.Equal(t, claimsValue, sessionData.JWTClaims.Extra[claimsKey])
				}
			}
		})
	}
}

func TestOAuth2ServiceImpl_handleJWTBearer(t *testing.T) {
	now := time.Now()
	client1 := &oauthserver.ExternalService{
		Name:             "testapp",
		ClientID:         "RANDOMID",
		GrantTypes:       string(fosite.GrantTypeJWTBearer),
		ServiceAccountID: 2,
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
	client1WithPerm := func(perms []ac.Permission) *oauthserver.ExternalService {
		client := *client1
		client.ImpersonatePermissions = perms
		return &client
	}

	tests := []struct {
		name           string
		initEnv        func(*TestEnv)
		scopes         []string
		client         *oauthserver.ExternalService
		subject        string
		expectedClaims map[string]interface{}
		wantErr        bool
	}{
		{
			name: "no claim without jwtbearer grant type",
			client: &oauthserver.ExternalService{
				Name:             "testapp",
				ClientID:         "RANDOMID",
				GrantTypes:       string(fosite.GrantTypeClientCredentials),
				ServiceAccountID: 2,
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
			client: &oauthserver.ExternalService{
				Name:             "testapp",
				ClientID:         "RANDOMID",
				GrantTypes:       string(fosite.GrantTypeJWTBearer),
				ServiceAccountID: 2,
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
			name: "no entitlement without permission intersection",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
					56: {"Viewer"}}, nil)
				env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
					56: {{Action: "dashboards:read", Scope: "dashboards:uid:1"}},
				}, nil)
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
				env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
					56: {"Viewer"}}, nil)
				env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
					56: {
						{Action: "dashboards:read", Scope: "dashboards:uid:1"},
						{Action: "datasources:read", Scope: "datasources:uid:1"},
					},
				}, nil)
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
				env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
					56: {"Viewer"}}, nil)
				env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
					56: {
						{Action: "users:read", Scope: "global.users:id:*"},
						{Action: "users.permissions:read", Scope: "users:id:*"},
					}}, nil)
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
				env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
					56: {"Viewer"}}, nil)
				env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
					56: {{Action: "teams:read", Scope: "teams:*"}}}, nil)
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "teams:read", Scope: "teams:self"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{"teams:read": {"teams:id:1", "teams:id:2"}},
			},
			scopes: []string{"entitlements"},
		},
		{
			name: "entitlements are correctly filtered based on scopes",
			initEnv: func(env *TestEnv) {
				env.UserService.ExpectedUser = user56
				env.TeamService.ExpectedTeamsByUser = teams
				env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
					56: {"Viewer"}}, nil)
				env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
					56: {
						{Action: "users:read", Scope: "global.users:id:*"},
						{Action: "datasources:read", Scope: "datasources:uid:1"},
					}}, nil)
			},
			client: client1WithPerm([]ac.Permission{
				{Action: "users:read", Scope: "global.users:*"},
				{Action: "datasources:read", Scope: "datasources:*"},
			}),
			subject: "user:id:56",
			expectedClaims: map[string]interface{}{
				"entitlements": map[string][]string{"users:read": {"global.users:id:*"}},
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
			sessionData := NewAuthSession()
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

			for claimsKey, claimsValue := range tt.expectedClaims {
				switch expected := claimsValue.(type) {
				case []string:
					require.ElementsMatch(t, claimsValue, sessionData.JWTClaims.Extra[claimsKey])
				case map[string][]string:
					actual, ok := sessionData.JWTClaims.Extra[claimsKey].(map[string][]string)
					require.True(t, ok, "expected map[string][]string")

					require.ElementsMatch(t, maps.Keys(expected), maps.Keys(actual))
					for expKey, expValue := range expected {
						require.ElementsMatch(t, expValue, actual[expKey])
					}
				default:
					require.Equal(t, claimsValue, sessionData.JWTClaims.Extra[claimsKey])
				}
			}

			env.AcStore.AssertExpectations(t)
		})
	}
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope"`
	TokenType   string `json:"token_type"`
}

type claims struct {
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
	tests := []struct {
		name            string
		tweakTestClient func(*oauthserver.ExternalService)
		reqParams       url.Values
		wantCode        int
		wantScope       []string
		wantClaims      *claims
	}{
		{
			name: "should allow client credentials grant",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeClientCredentials)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"CLIENT1SECRET"},
				"scope":         {"profile email groups entitlements"},
				"audience":      {AppURL},
			},
			wantCode:  http.StatusOK,
			wantScope: []string{"profile", "email", "groups", "entitlements"},
			wantClaims: &claims{
				Claims: jwt.Claims{
					Subject:  "user:id:2", // From client1.ServiceAccountID
					Issuer:   AppURL,      // From env.S.Config.Issuer
					Audience: jwt.Audience{AppURL},
				},
				ClientID: "CLIENT1ID",
				Name:     "client-1",
				Login:    "client-1",
				Entitlements: map[string][]string{
					"users:impersonate": {"users:*"},
				},
			},
		},
		{
			name: "should allow jwt-bearer grant",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeJWTBearer)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"CLIENT1SECRET"},
				"assertion": {
					genAssertion(t, Client1Key, "CLIENT1ID", "user:id:56", TokenURL, AppURL),
				},
				"scope": {"profile email groups entitlements"},
			},
			wantCode:  http.StatusOK,
			wantScope: []string{"profile", "email", "groups", "entitlements"},
			wantClaims: &claims{
				Claims: jwt.Claims{
					Subject:  "user:id:56", // To match the assertion
					Issuer:   AppURL,       // From env.S.Config.Issuer
					Audience: jwt.Audience{TokenURL, AppURL},
				},
				ClientID: "CLIENT1ID",
				Email:    "user56@example.org",
				Name:     "User 56",
				Login:    "user56",
				Groups:   []string{"Team 1", "Team 2"},
				Entitlements: map[string][]string{
					"dashboards:read": {"folders:uid:UID1"},
					"folders:read":    {"folders:uid:UID1"},
					"users:read":      {"global.users:id:56"},
				},
			},
		},
		{
			name: "should deny jwt-bearer grant with wrong audience",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeJWTBearer)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"CLIENT1SECRET"},
				"assertion": {
					genAssertion(t, Client1Key, "CLIENT1ID", "user:id:56", TokenURL, "invalid audience"),
				},
				"scope": {"profile email groups entitlements"},
			},
			wantCode: http.StatusForbidden,
		},
		{
			name: "should deny jwt-bearer grant for clients without the grant",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeJWTBearer)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"CLIENT1SECRET"},
				"assertion": {
					genAssertion(t, Client1Key, "CLIENT1ID", "user:id:56", TokenURL, AppURL),
				},
				"scope": {"profile email groups entitlements"},
			},
			tweakTestClient: func(es *oauthserver.ExternalService) {
				es.GrantTypes = string(fosite.GrantTypeClientCredentials)
			},
			wantCode: http.StatusBadRequest,
		},
		{
			name: "should deny client_credentials grant for clients without the grant",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeClientCredentials)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"CLIENT1SECRET"},
				"scope":         {"profile email groups entitlements"},
				"audience":      {AppURL},
			},
			tweakTestClient: func(es *oauthserver.ExternalService) {
				es.GrantTypes = string(fosite.GrantTypeJWTBearer)
			},
			wantCode: http.StatusBadRequest,
		},
		{
			name: "should deny client_credentials grant with wrong secret",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeClientCredentials)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"WRONG_SECRET"},
				"scope":         {"profile email groups entitlements"},
				"audience":      {AppURL},
			},
			tweakTestClient: func(es *oauthserver.ExternalService) {
				es.GrantTypes = string(fosite.GrantTypeClientCredentials)
			},
			wantCode: http.StatusUnauthorized,
		},
		{
			name: "should deny jwt-bearer grant with wrong secret",
			reqParams: url.Values{
				"grant_type":    {string(fosite.GrantTypeJWTBearer)},
				"client_id":     {"CLIENT1ID"},
				"client_secret": {"WRONG_SECRET"},
				"assertion": {
					genAssertion(t, Client1Key, "CLIENT1ID", "user:id:56", TokenURL, AppURL),
				},
				"scope": {"profile email groups entitlements"},
			},
			tweakTestClient: func(es *oauthserver.ExternalService) {
				es.GrantTypes = string(fosite.GrantTypeJWTBearer)
			},
			wantCode: http.StatusUnauthorized,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			env := setupTestEnv(t)
			setupHandleTokenRequestEnv(t, env, tt.tweakTestClient)

			req := httptest.NewRequest("POST", "/oauth2/token", strings.NewReader(tt.reqParams.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

			resp := httptest.NewRecorder()

			env.S.HandleTokenRequest(resp, req)

			require.Equal(t, tt.wantCode, resp.Code)
			if tt.wantCode != http.StatusOK {
				return
			}

			body := resp.Body.Bytes()
			require.NotEmpty(t, body)

			var tokenResp tokenResponse
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
			var claims claims
			require.NoError(t, parsedToken.Claims(pk.Public(), &claims))
			// Check times and remove them
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

func genAssertion(t *testing.T, signKey *rsa.PrivateKey, clientID, sub string, audience ...string) string {
	key := jose.SigningKey{Algorithm: jose.RS256, Key: signKey}
	assertion := jwt.Claims{
		ID:       uuid.New().String(),
		Issuer:   clientID,
		Subject:  sub,
		Audience: audience,
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Hour)),
		IssuedAt: jwt.NewNumericDate(time.Now()),
	}

	var signerOpts = jose.SignerOptions{}
	signerOpts.WithType("JWT")
	rsaSigner, errSigner := jose.NewSigner(key, &signerOpts)
	require.NoError(t, errSigner)
	builder := jwt.Signed(rsaSigner)
	rawJWT, errSign := builder.Claims(assertion).CompactSerialize()
	require.NoError(t, errSign)
	return rawJWT
}

// setupHandleTokenRequestEnv creates a client and a user and sets all Mocks call for the handleTokenRequest test cases
func setupHandleTokenRequestEnv(t *testing.T, env *TestEnv, opt func(*oauthserver.ExternalService)) {
	now := time.Now()
	hashedSecret, err := bcrypt.GenerateFromPassword([]byte("CLIENT1SECRET"), bcrypt.DefaultCost)
	require.NoError(t, err)
	client1 := &oauthserver.ExternalService{
		Name:             "client-1",
		ClientID:         "CLIENT1ID",
		Secret:           string(hashedSecret),
		GrantTypes:       string(fosite.GrantTypeClientCredentials + "," + fosite.GrantTypeJWTBearer),
		ServiceAccountID: 2,
		ImpersonatePermissions: []ac.Permission{
			{Action: "users:read", Scope: oauthserver.ScopeGlobalUsersSelf},
			{Action: "users.permissions:read", Scope: oauthserver.ScopeUsersSelf},
			{Action: "teams:read", Scope: oauthserver.ScopeTeamsSelf},

			{Action: "folders:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "folders:*"},
			{Action: "dashboards:read", Scope: "dashboards:*"},
		},
		SelfPermissions: []ac.Permission{
			{Action: "users:impersonate", Scope: "users:*"},
		},
		Audiences: AppURL,
	}

	// Apply any option the test case might need
	if opt != nil {
		opt(client1)
	}

	sa1 := &serviceaccounts.ServiceAccountProfileDTO{
		Id:         client1.ServiceAccountID,
		Name:       client1.Name,
		Login:      client1.Name,
		OrgId:      oauthserver.TmpOrgID,
		IsDisabled: false,
		Created:    now,
		Updated:    now,
		Role:       "Viewer",
	}

	user56 := &user.User{
		ID:      56,
		Email:   "user56@example.org",
		Login:   "user56",
		Name:    "User 56",
		Updated: now,
	}
	user56Permissions := []ac.Permission{
		{Action: "users:read", Scope: "global.users:id:56"},
		{Action: "folders:read", Scope: "folders:uid:UID1"},
		{Action: "dashboards:read", Scope: "folders:uid:UID1"},
		{Action: "datasources:read", Scope: "datasources:uid:DS_UID2"}, // This one should be ignored when impersonating
	}
	user56Teams := []*team.TeamDTO{
		{ID: 1, Name: "Team 1", OrgID: 1},
		{ID: 2, Name: "Team 2", OrgID: 1},
	}

	// To retrieve the Client, its publicKey and its permissions
	env.OAuthStore.On("GetExternalService", mock.Anything, client1.ClientID).Return(client1, nil)
	env.OAuthStore.On("GetExternalServicePublicKey", mock.Anything, client1.ClientID).Return(&jose.JSONWebKey{Key: Client1Key.Public(), Algorithm: "RS256"}, nil)
	env.SAService.On("RetrieveServiceAccount", mock.Anything, oauthserver.TmpOrgID, client1.ServiceAccountID).Return(sa1, nil)
	env.AcStore.On("GetUserPermissions", mock.Anything, mock.Anything).Return(client1.SelfPermissions, nil)
	// To retrieve the user to impersonate, its permissions and its teams
	env.AcStore.On("SearchUsersPermissions", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]ac.Permission{
		user56.ID: user56Permissions}, nil)
	env.AcStore.On("GetUsersBasicRoles", mock.Anything, mock.Anything, mock.Anything).Return(map[int64][]string{
		user56.ID: {"Viewer"}}, nil)
	env.TeamService.ExpectedTeamsByUser = user56Teams
	env.UserService.ExpectedUser = user56
}
