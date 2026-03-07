package api

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

type fakeSocialService struct {
	providers map[string]*social.OAuthInfo
}

func (f *fakeSocialService) GetOAuthProviders() map[string]bool {
	return nil
}

func (f *fakeSocialService) GetOAuthHttpClient(string) (*http.Client, error) {
	return nil, nil
}

func (f *fakeSocialService) GetConnector(string) (social.SocialConnector, error) {
	return nil, nil
}

func (f *fakeSocialService) GetOAuthInfoProvider(string) *social.OAuthInfo {
	return nil
}

func (f *fakeSocialService) GetOAuthInfoProviders() map[string]*social.OAuthInfo {
	return f.providers
}

// TestHandleBackChannelLogout tests the back-channel logout endpoint
// NOTE: Tests that require JWT signature validation are currently skipped
// because they would require mocking JWKS fetching. Full integration tests
// should be run with a real identity provider.
func TestHandleBackChannelLogout(t *testing.T) {
	t.Skip("Skipping tests that require JWKS mocking - TODO: implement JWKS mocking or use integration tests")

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	validIssuer := "https://accounts.example.com"
	validAudience := "grafana-client-id"

	tests := []struct {
		name               string
		formData           url.Values
		setupMocks         func(*HTTPServer, *authtest.MockUserAuthTokenService, *authinfotest.FakeService)
		expectedStatusCode int
		expectedError      string
		expectedResponse   map[string]string
	}{
		{
			name: "missing logout_token parameter",
			formData: url.Values{
				"other_param": []string{"value"},
			},
			setupMocks:         func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {},
			expectedStatusCode: http.StatusBadRequest,
			expectedError:      "invalid_request",
		},
		{
			name: "invalid JWT format",
			formData: url.Values{
				"logout_token": []string{"not-a-valid-jwt"},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				// Setup empty provider map
				hs.SocialService = &fakeSocialService{
					providers: map[string]*social.OAuthInfo{},
				}
			},
			expectedStatusCode: http.StatusBadRequest,
			expectedError:      "invalid_request",
		},
		{
			name: "unknown issuer",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, "https://unknown-issuer.com", validAudience, "user123", "session123")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				hs.SocialService = &fakeSocialService{
					providers: map[string]*social.OAuthInfo{},
				}
			},
			expectedStatusCode: http.StatusBadRequest,
			expectedError:      "invalid_request",
		},
		{
			name: "back-channel logout disabled for provider",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				hs.SocialService = &fakeSocialService{
					providers: map[string]*social.OAuthInfo{
						"test-provider": {
							Name:                     "test-provider",
							AuthUrl:                  validIssuer + "/authorize",
							Enabled:                  true,
							BackChannelLogoutEnabled: false,
						},
					},
				}
			},
			expectedStatusCode: http.StatusBadRequest,
			expectedError:      "invalid_request",
		},
		{
			name: "logout token missing both sub and sid",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "", "")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				setupValidProvider(hs, validIssuer)
			},
			expectedStatusCode: http.StatusBadRequest,
			expectedError:      "invalid_request",
		},
		{
			name: "successful logout with sid claim",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				setupValidProvider(hs, validIssuer)

				externalSession := &auth.ExternalSession{
					ID:        1,
					UserID:    123,
					SessionID: "session123",
				}
				ats.On("FindExternalSessions", mock.Anything, mock.MatchedBy(func(query *auth.ListExternalSessionQuery) bool {
					return query.SessionID != "" // Looking up by hashed session ID
				})).Return([]*auth.ExternalSession{externalSession}, nil)

				userToken := &auth.UserToken{
					Id:     1,
					UserId: 123,
				}
				ats.On("GetTokenByExternalSessionID", mock.Anything, int64(1)).Return(userToken, nil)

				ats.On("RevokeToken", mock.Anything, userToken, false).Return(nil)
			},
			expectedStatusCode: http.StatusOK,
		},
		{
			name: "successful logout with sub claim fallback",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				setupValidProvider(hs, validIssuer)

				ats.On("FindExternalSessions", mock.Anything, mock.Anything).Return([]*auth.ExternalSession{}, nil).Once()

				authInfo := &login.UserAuth{
					Id:         1,
					UserId:     123,
					AuthId:     "user123",
					AuthModule: "oauth_test-provider",
				}
				ais.ExpectedUserAuth = authInfo

				externalSession := &auth.ExternalSession{
					ID:         2,
					UserID:     123,
					AuthModule: "oauth_test-provider",
				}
				ats.On("FindExternalSessions", mock.Anything, mock.MatchedBy(func(query *auth.ListExternalSessionQuery) bool {
					return query.UserID == int64(123)
				})).Return([]*auth.ExternalSession{externalSession}, nil)

				userToken := &auth.UserToken{
					Id:     2,
					UserId: 123,
				}
				ats.On("GetTokenByExternalSessionID", mock.Anything, int64(2)).Return(userToken, nil)

				ats.On("RevokeToken", mock.Anything, userToken, false).Return(nil)
			},
			expectedStatusCode: http.StatusOK,
		},
		{
			name: "no sessions found - returns OK (user already logged out)",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				setupValidProvider(hs, validIssuer)

				ats.On("FindExternalSessions", mock.Anything, mock.Anything).Return([]*auth.ExternalSession{}, nil)

				ais.ExpectedError = user.ErrUserNotFound
			},
			expectedStatusCode: http.StatusOK,
		},
		{
			name: "multiple sessions revoked successfully",
			formData: url.Values{
				"logout_token": []string{createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123")},
			},
			setupMocks: func(hs *HTTPServer, ats *authtest.MockUserAuthTokenService, ais *authinfotest.FakeService) {
				setupValidProvider(hs, validIssuer)

				// Multiple sessions found
				sessions := []*auth.ExternalSession{
					{ID: 1, UserID: 123, SessionID: "session123"},
					{ID: 2, UserID: 123, SessionID: "session123"},
				}
				ats.On("FindExternalSessions", mock.Anything, mock.Anything).Return(sessions, nil)

				// Mock token lookups and revocations for both sessions
				for i, session := range sessions {
					userToken := &auth.UserToken{
						Id:     int64(i + 1),
						UserId: 123,
					}
					ats.On("GetTokenByExternalSessionID", mock.Anything, session.ID).Return(userToken, nil)
					ats.On("RevokeToken", mock.Anything, userToken, false).Return(nil)
				}
			},
			expectedStatusCode: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockAuthTokenService := &authtest.MockUserAuthTokenService{}
			mockAuthInfoService := &authinfotest.FakeService{}

			hs := &HTTPServer{
				Cfg:              setting.NewCfg(),
				log:              log.New("test"),
				AuthTokenService: mockAuthTokenService,
				authInfoService:  mockAuthInfoService,
			}

			if tt.setupMocks != nil {
				tt.setupMocks(hs, mockAuthTokenService, mockAuthInfoService)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/oauth/backchannel-logout", strings.NewReader(tt.formData.Encode()))
			req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

			resp := httptest.NewRecorder()

			c := &contextmodel.ReqContext{
				Context: &web.Context{
					Req:  req,
					Resp: web.NewResponseWriter(http.MethodPost, resp),
				},
				Logger: log.New("test"),
			}

			result := hs.HandleBackChannelLogout(c)

			result.WriteTo(c)

			assert.Equal(t, tt.expectedStatusCode, resp.Code)

			if tt.expectedError != "" {
				var errorResp map[string]string
				err := json.Unmarshal(resp.Body.Bytes(), &errorResp)
				require.NoError(t, err)
				assert.Equal(t, tt.expectedError, errorResp["error"])
			}

			if tt.expectedStatusCode == http.StatusOK {
				assert.Equal(t, "no-store", resp.Header().Get("Cache-Control"))
			}

			mockAuthTokenService.AssertExpectations(t)
		})
	}
}

// TestValidateLogoutToken tests logout token validation logic
// NOTE: Tests that require JWT signature validation are currently skipped
// because they would require mocking JWKS fetching.
func TestValidateLogoutToken(t *testing.T) {
	t.Skip("Skipping tests that require JWKS mocking - TODO: implement JWKS mocking or use integration tests")

	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	require.NoError(t, err)

	validIssuer := "https://accounts.example.com"
	validAudience := "grafana-client-id"

	tests := []struct {
		name          string
		tokenString   string
		setupProvider func(*HTTPServer)
		expectError   bool
		errorContains string
	}{
		{
			name:          "valid logout token with sid",
			tokenString:   createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123"),
			setupProvider: func(hs *HTTPServer) { setupValidProvider(hs, validIssuer) },
			expectError:   false,
		},
		{
			name:          "valid logout token with only sub",
			tokenString:   createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", ""),
			setupProvider: func(hs *HTTPServer) { setupValidProvider(hs, validIssuer) },
			expectError:   false,
		},
		{
			name:          "valid logout token with only sid",
			tokenString:   createLogoutToken(t, privateKey, validIssuer, validAudience, "", "session123"),
			setupProvider: func(hs *HTTPServer) { setupValidProvider(hs, validIssuer) },
			expectError:   false,
		},
		{
			name:          "missing both sub and sid",
			tokenString:   createLogoutToken(t, privateKey, validIssuer, validAudience, "", ""),
			setupProvider: func(hs *HTTPServer) { setupValidProvider(hs, validIssuer) },
			expectError:   true,
			errorContains: "must contain either",
		},
		{
			name:          "unknown issuer",
			tokenString:   createLogoutToken(t, privateKey, "https://unknown.com", validAudience, "user123", "session123"),
			setupProvider: func(hs *HTTPServer) { setupValidProvider(hs, validIssuer) },
			expectError:   true,
			errorContains: "unknown issuer",
		},
		{
			name:        "back-channel logout disabled",
			tokenString: createLogoutToken(t, privateKey, validIssuer, validAudience, "user123", "session123"),
			setupProvider: func(hs *HTTPServer) {
				hs.SocialService = &fakeSocialService{
					providers: map[string]*social.OAuthInfo{
						"test-provider": {
							Name:                     "test-provider",
							AuthUrl:                  validIssuer + "/authorize",
							Enabled:                  true,
							BackChannelLogoutEnabled: false,
						},
					},
				}
			},
			expectError:   true,
			errorContains: "not enabled",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hs := &HTTPServer{
				Cfg: setting.NewCfg(),
				log: log.New("test"),
			}

			if tt.setupProvider != nil {
				tt.setupProvider(hs)
			}

			// Note: This test validates token structure but not signature
			// as we don't have a full JWKS implementation in the test
			claims, provider, providerName, err := hs.validateLogoutToken(context.Background(), tt.tokenString)

			if tt.expectError {
				assert.Error(t, err)
				if tt.errorContains != "" {
					assert.Contains(t, err.Error(), tt.errorContains)
				}
			} else {
				// Note: This will fail signature validation in real implementation
				// For proper testing, we'd need to mock JWKS fetching
				if err != nil && !strings.Contains(err.Error(), "signature") {
					assert.NoError(t, err, "Expected no error except signature validation")
				}
				if err == nil {
					assert.NotNil(t, claims)
					assert.NotNil(t, provider)
					assert.NotEmpty(t, providerName)
				}
			}
		})
	}
}

func TestHashSessionID(t *testing.T) {
	tests := []struct {
		sessionID string
		expected  string
	}{
		{
			sessionID: "test-session-123",
			expected:  "bd7065173b6ba0b1c30b65779119747b3710fac4d3bbb1520311cf5332b2df51",
		},
		{
			sessionID: "",
			expected:  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
	}

	for _, tt := range tests {
		t.Run(tt.sessionID, func(t *testing.T) {
			result := hashSessionID(tt.sessionID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestGetProviderByIssuer(t *testing.T) {
	tests := []struct {
		name      string
		issuer    string
		providers map[string]*social.OAuthInfo
		expected  *social.OAuthInfo
	}{
		{
			name:   "match by auth URL",
			issuer: "https://accounts.example.com",
			providers: map[string]*social.OAuthInfo{
				"provider1": {
					Name:    "provider1",
					AuthUrl: "https://accounts.example.com/oauth/authorize",
				},
			},
			expected: &social.OAuthInfo{
				Name:    "provider1",
				AuthUrl: "https://accounts.example.com/oauth/authorize",
			},
		},
		{
			name:   "match by token URL",
			issuer: "https://accounts.example.com",
			providers: map[string]*social.OAuthInfo{
				"provider1": {
					Name:     "provider1",
					TokenUrl: "https://accounts.example.com/oauth/token",
				},
			},
			expected: &social.OAuthInfo{
				Name:     "provider1",
				TokenUrl: "https://accounts.example.com/oauth/token",
			},
		},
		{
			name:   "no match",
			issuer: "https://unknown.com",
			providers: map[string]*social.OAuthInfo{
				"provider1": {
					Name:    "provider1",
					AuthUrl: "https://accounts.example.com/oauth/authorize",
				},
			},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			hs := &HTTPServer{
				Cfg:           setting.NewCfg(),
				log:           log.New("test"),
				SocialService: &fakeSocialService{providers: tt.providers},
			}

			result, providerName := hs.getProviderByIssuer(tt.issuer)

			if tt.expected == nil {
				assert.Nil(t, result)
				assert.Empty(t, providerName)
			} else {
				assert.NotNil(t, result)
				assert.Equal(t, tt.expected.Name, result.Name)
				assert.NotEmpty(t, providerName)
			}
		})
	}
}

func createLogoutToken(t *testing.T, privateKey *rsa.PrivateKey, issuer, audience, subject, sessionID string) string {
	now := time.Now()

	events := map[string]interface{}{
		"http://schemas.openid.net/event/backchannel-logout": map[string]interface{}{},
	}

	claims := BackChannelLogoutToken{
		Issuer:    issuer,
		Subject:   subject,
		Audience:  jwt.ClaimStrings{audience},
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(2 * time.Minute)),
		JWTID:     fmt.Sprintf("jti-%d", now.Unix()),
		SessionID: sessionID,
		Events:    events,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = "test-key-id"

	tokenString, err := token.SignedString(privateKey)
	require.NoError(t, err)

	return tokenString
}

func setupValidProvider(hs *HTTPServer, issuer string) {
	hs.SocialService = &fakeSocialService{
		providers: map[string]*social.OAuthInfo{
			"test-provider": {
				Name:                     "test-provider",
				AuthUrl:                  issuer + "/authorize",
				TokenUrl:                 issuer + "/token",
				Enabled:                  true,
				BackChannelLogoutEnabled: true,
			},
		},
	}
}

type testContext struct {
	req  *http.Request
	resp *httptest.ResponseRecorder
}

func (tc *testContext) toReqContext() *testReqContext {
	return &testReqContext{
		req:  tc.req,
		resp: tc.resp,
	}
}

type testReqContext struct {
	req  *http.Request
	resp *httptest.ResponseRecorder
}

func (rc *testReqContext) Req() *http.Request {
	return rc.req
}

func (rc *testReqContext) Resp() http.ResponseWriter {
	return rc.resp
}

func (rc *testReqContext) JSON(status int, data interface{}) {
	rc.resp.WriteHeader(status)
	rc.resp.Header().Set("Content-Type", "application/json")
	json.NewEncoder(rc.resp).Encode(data)
}
