package oauth

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func TestConnection_Test(t *testing.T) {
	tests := []struct {
		name           string
		token          common.RawSecureValue
		listErr        error
		expectedCode   int
		expectedErrors []provisioning.ErrorDetails
		expectSuccess  bool
	}{
		{
			name:          "success - token accepted by provider",
			token:         marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
			expectedCode:  http.StatusOK,
			expectSuccess: true,
		},
		{
			name:         "failure - no token stored",
			expectedCode: http.StatusUnauthorized,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueRequired,
					Field:  "secure.token",
					Detail: "This connection has not been authorized yet",
				},
			},
		},
		{
			name:         "failure - stored token is not valid JSON",
			token:        "not-json",
			expectedCode: http.StatusUnauthorized,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueRequired,
					Field:  "secure.token",
					Detail: "This connection has not been authorized yet",
				},
			},
		},
		{
			name:         "failure - token has no access token",
			token:        marshalTestToken(t, &oauth2.Token{RefreshToken: "refresh"}),
			expectedCode: http.StatusUnauthorized,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueRequired,
					Field:  "secure.token",
					Detail: "This connection has not been authorized yet",
				},
			},
		},
		{
			name:         "failure - provider rejects token",
			token:        marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
			listErr:      connection.ErrAuthentication,
			expectedCode: http.StatusUnauthorized,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeFieldValueInvalid,
					Field:  "secure.token",
					Detail: "The provider rejected the connection's access token",
				},
			},
		},
		{
			name:         "failure - provider returns other error",
			token:        marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
			listErr:      errors.New("boom"),
			expectedCode: http.StatusUnprocessableEntity,
			expectedErrors: []provisioning.ErrorDetails{
				{
					Type:   metav1.CauseTypeInternal,
					Detail: "failed to list repositories: boom",
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := newMockProvider(t, "")
			provider.EXPECT().ListRepositories(mock.Anything).Return(nil, tt.listErr).Maybe()
			conn := newConnection(provider, provisioning.GitLabRepositoryType, testOAuthConfig, "", tt.token)

			results, err := conn.Test(t.Context())
			require.NoError(t, err)
			assert.Equal(t, tt.expectSuccess, results.Success)
			assert.Equal(t, tt.expectedCode, results.Code)
			assert.Equal(t, tt.expectedErrors, results.Errors)
		})
	}
}

func TestConnection_GenerateRepositoryToken(t *testing.T) {
	expiry := time.Now().Add(time.Hour).Truncate(time.Second)

	tests := []struct {
		name        string
		repo        *provisioning.Repository
		token       common.RawSecureValue
		expectedErr string
		validate    func(t *testing.T, value *connection.ExpirableSecureValue)
	}{
		{
			name:  "success - expiring token",
			repo:  &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitLabRepositoryType}},
			token: marshalTestToken(t, &oauth2.Token{AccessToken: "access", Expiry: expiry}),
			validate: func(t *testing.T, value *connection.ExpirableSecureValue) {
				assert.Equal(t, common.RawSecureValue("access"), value.Token)
				assert.True(t, value.ExpiresAt.Equal(expiry))
			},
		},
		{
			name:  "success - non-expiring token",
			repo:  &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitLabRepositoryType}},
			token: marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
			validate: func(t *testing.T, value *connection.ExpirableSecureValue) {
				assert.Equal(t, common.RawSecureValue("access"), value.Token)
				assert.True(t, value.ExpiresAt.IsZero())
			},
		},
		{
			name:        "failure - nil repository",
			expectedErr: "a repository is required to generate a token",
		},
		{
			name:        "failure - repository type mismatch",
			repo:        &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitHubRepositoryType}},
			expectedErr: `repository type "github" is not served by this connection (serves "gitlab")`,
		},
		{
			name:        "failure - no token stored",
			repo:        &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitLabRepositoryType}},
			expectedErr: "connection access token not available",
		},
		{
			name:        "failure - expired token",
			repo:        &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.GitLabRepositoryType}},
			token:       marshalTestToken(t, &oauth2.Token{AccessToken: "access", Expiry: time.Now().Add(-time.Hour)}),
			expectedErr: "connection access token expired",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := newConnection(newMockProvider(t, ""), provisioning.GitLabRepositoryType, testOAuthConfig, "", tt.token)

			value, err := conn.GenerateRepositoryToken(t.Context(), tt.repo)
			if tt.expectedErr != "" {
				require.ErrorContains(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)
			tt.validate(t, value)
		})
	}
}

func TestConnection_ListRepositories(t *testing.T) {
	repos := []provisioning.ExternalRepository{{Name: "repo", Owner: "owner", URL: "https://gitlab.com/owner/repo"}}

	t.Run("success", func(t *testing.T) {
		provider := newMockProvider(t, "")
		provider.EXPECT().ListRepositories(mock.Anything).Return(repos, nil)
		conn := newConnection(provider, provisioning.GitLabRepositoryType, testOAuthConfig, "",
			marshalTestToken(t, &oauth2.Token{AccessToken: "access"}))

		result, err := conn.ListRepositories(t.Context())
		require.NoError(t, err)
		assert.Equal(t, repos, result)
	})

	t.Run("failure - no token stored", func(t *testing.T) {
		conn := newConnection(newMockProvider(t, ""), provisioning.GitLabRepositoryType, testOAuthConfig, "", "")

		_, err := conn.ListRepositories(t.Context())
		require.ErrorIs(t, err, connection.ErrAuthentication)
	})
}

func TestConnection_GenerateConnectionToken(t *testing.T) {
	tests := []struct {
		name         string
		token        common.RawSecureValue
		response     map[string]any
		responseCode int
		expectedErr  string
		validate     func(t *testing.T, token *oauth2.Token)
	}{
		{
			name:  "success - provider rotates refresh token",
			token: marshalTestToken(t, &oauth2.Token{AccessToken: "old-access", RefreshToken: "old-refresh"}),
			response: map[string]any{
				"access_token":  "new-access",
				"refresh_token": "new-refresh",
				"expires_in":    3600,
			},
			validate: func(t *testing.T, token *oauth2.Token) {
				assert.Equal(t, "new-access", token.AccessToken)
				assert.Equal(t, "new-refresh", token.RefreshToken)
				assert.False(t, token.Expiry.IsZero())
			},
		},
		{
			name:  "success - refresh token kept when provider omits it",
			token: marshalTestToken(t, &oauth2.Token{AccessToken: "old-access", RefreshToken: "old-refresh"}),
			response: map[string]any{
				"access_token": "new-access",
			},
			validate: func(t *testing.T, token *oauth2.Token) {
				assert.Equal(t, "new-access", token.AccessToken)
				assert.Equal(t, "old-refresh", token.RefreshToken)
			},
		},
		{
			name:        "failure - no token stored",
			expectedErr: "no token available",
		},
		{
			name:        "failure - no refresh token",
			token:       marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
			expectedErr: "no refresh token available; authorize the OAuth application again",
		},
		{
			name:         "failure - token endpoint rejects refresh",
			token:        marshalTestToken(t, &oauth2.Token{AccessToken: "old-access", RefreshToken: "old-refresh"}),
			responseCode: http.StatusUnauthorized,
			expectedErr:  "refresh access token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := newTokenServer(t, tt.responseCode, tt.response)
			conn := newConnection(newMockProvider(t, srv.URL), provisioning.GitLabRepositoryType, testOAuthConfig, "client-secret", tt.token)

			raw, err := conn.GenerateConnectionToken(t.Context())
			if tt.expectedErr != "" {
				require.ErrorContains(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)

			token := &oauth2.Token{}
			require.NoError(t, json.Unmarshal([]byte(raw), token))
			tt.validate(t, token)
		})
	}
}

func TestConnection_ExchangeAuthorizationCode(t *testing.T) {
	tests := []struct {
		name         string
		code         string
		response     map[string]any
		responseCode int
		expectedErr  string
	}{
		{
			name: "success",
			code: "auth-code",
			response: map[string]any{
				"access_token":  "access",
				"refresh_token": "refresh",
			},
		},
		{
			name:        "failure - empty code",
			expectedErr: "an authorization code is required",
		},
		{
			name:         "failure - endpoint rejects code",
			code:         "auth-code",
			responseCode: http.StatusBadRequest,
			expectedErr:  "exchange authorization code",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			srv := newTokenServer(t, tt.responseCode, tt.response)
			conn := newConnection(newMockProvider(t, srv.URL), provisioning.GitLabRepositoryType, testOAuthConfig, "client-secret", "")

			raw, err := conn.ExchangeAuthorizationCode(t.Context(), tt.code, "https://grafana.example/callback")
			if tt.expectedErr != "" {
				require.ErrorContains(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)

			token := &oauth2.Token{}
			require.NoError(t, json.Unmarshal([]byte(raw), token))
			assert.Equal(t, "access", token.AccessToken)
			assert.Equal(t, "refresh", token.RefreshToken)
		})
	}
}

func TestConnection_ValidateToken(t *testing.T) {
	expiry := time.Now().Add(time.Hour).Truncate(time.Second)

	tests := []struct {
		name         string
		token        common.RawSecureValue
		expectedErr  string
		expectExpiry time.Time
	}{
		{
			name:         "valid token with expiry",
			token:        marshalTestToken(t, &oauth2.Token{AccessToken: "access", Expiry: expiry}),
			expectExpiry: expiry,
		},
		{
			name:  "valid token without expiry",
			token: marshalTestToken(t, &oauth2.Token{AccessToken: "access"}),
		},
		{
			name:        "token without access token",
			token:       marshalTestToken(t, &oauth2.Token{RefreshToken: "refresh"}),
			expectedErr: "stored token has no access token",
		},
		{
			name:        "no token stored",
			expectedErr: "no token available",
		},
		{
			name:        "invalid token payload",
			token:       "not-json",
			expectedErr: "stored token is not a valid token payload",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			conn := newConnection(newMockProvider(t, ""), provisioning.GitLabRepositoryType, testOAuthConfig, "", tt.token)

			tokenExpiry, err := conn.ValidateToken()
			if tt.expectedErr != "" {
				require.EqualError(t, err, tt.expectedErr)
				return
			}
			require.NoError(t, err)
			assert.True(t, tokenExpiry.Equal(tt.expectExpiry))
		})
	}
}

var testOAuthConfig = provisioning.ConnectionOAuthConfig{ClientID: "client-id"}

func newMockProvider(t *testing.T, tokenURL string) *MockProvider {
	provider := NewMockProvider(t)
	provider.EXPECT().Endpoint().Return(oauth2.Endpoint{TokenURL: tokenURL}).Maybe()
	return provider
}

func marshalTestToken(t *testing.T, token *oauth2.Token) common.RawSecureValue {
	t.Helper()
	b, err := json.Marshal(token) // #nosec G117 -- test fixture for the stored token payload
	require.NoError(t, err)
	return common.RawSecureValue(b)
}

func newTokenServer(t *testing.T, code int, response map[string]any) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		if code != 0 {
			http.Error(w, "denied", code)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		require.NoError(t, json.NewEncoder(w).Encode(response))
	}))
	t.Cleanup(srv.Close)
	return srv
}
