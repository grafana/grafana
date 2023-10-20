package clients

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/socialtest"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

func TestSession_Test(t *testing.T) {
	cookieName := "grafana_session"

	validHTTPReq := &http.Request{
		Header: map[string][]string{},
	}
	validHTTPReq.AddCookie(&http.Cookie{Name: cookieName, Value: "bob-the-high-entropy-token"})
	cfg := setting.NewCfg()
	cfg.LoginCookieName = ""
	cfg.LoginMaxLifetime = 20 * time.Second
	s := ProvideSession(cfg, featuremgmt.WithFeatures(), &authtest.FakeUserAuthTokenService{}, nil, nil)

	disabled := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.False(t, disabled)

	s.cfg.LoginCookieName = cookieName

	good := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.True(t, good)

	invalidHTTPReq := &http.Request{Header: map[string][]string{}}

	bad := s.Test(context.Background(), &authn.Request{HTTPRequest: invalidHTTPReq})
	assert.False(t, bad)
}

func TestSession_Authenticate(t *testing.T) {
	cookieName := "grafana_session"

	validHTTPReq := &http.Request{
		Header: map[string][]string{},
	}
	validHTTPReq.AddCookie(&http.Cookie{Name: cookieName, Value: "bob-the-high-entropy-token"})

	validToken := &usertoken.UserToken{
		Id:            1,
		UserId:        1,
		AuthToken:     "hashyToken",
		PrevAuthToken: "prevHashyToken",
		AuthTokenSeen: true,
		RotatedAt:     time.Now().Unix(),
	}

	type fields struct {
		sessionService auth.UserTokenService
		features       *featuremgmt.FeatureManager
	}
	type args struct {
		r *authn.Request
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantID  *authn.Identity
		wantErr bool
	}{
		{
			name: "cookie not found",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{},
				features:       featuremgmt.WithFeatures(),
			},
			args:    args{r: &authn.Request{HTTPRequest: &http.Request{}}},
			wantID:  nil,
			wantErr: true,
		},
		{
			name: "success",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				features: featuremgmt.WithFeatures(),
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "user:1",
				SessionToken: validToken,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
		{
			name: "should return error for token that needs rotation if ClientTokenRotation is enabled",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return &auth.UserToken{
						AuthTokenSeen: true,
						RotatedAt:     time.Now().Add(-11 * time.Minute).Unix(),
					}, nil
				}},
				features: featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation),
			},
			args:    args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantErr: true,
		},
		{
			name: "should return identity for token that don't need rotation if ClientTokenRotation is enabled",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				features: featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation),
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "user:1",
				SessionToken: validToken,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginCookieName = cookieName
			cfg.TokenRotationIntervalMinutes = 10
			cfg.LoginMaxLifetime = 20 * time.Second
			s := ProvideSession(cfg, tt.fields.features, tt.fields.sessionService, nil, nil)

			got, err := s.Authenticate(context.Background(), tt.args.r)
			require.True(t, (err != nil) == tt.wantErr, err)
			if err != nil {
				return
			}

			require.EqualValues(t, tt.wantID, got)
		})
	}
}

type fakeResponseWriter struct {
	Status      int
	HeaderStore http.Header
}

func (f *fakeResponseWriter) Header() http.Header {
	return f.HeaderStore
}

func (f *fakeResponseWriter) Write([]byte) (int, error) {
	return 0, nil
}

func (f *fakeResponseWriter) WriteHeader(statusCode int) {
	f.Status = statusCode
}

func TestSession_RotateSessionHook(t *testing.T) {
	t.Run("should rotate token", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana-session"
		cfg.LoginMaxLifetime = 20 * time.Second
		s := ProvideSession(cfg, featuremgmt.WithFeatures(), &authtest.FakeUserAuthTokenService{
			TryRotateTokenProvider: func(_ context.Context, token *auth.UserToken, _ net.IP, _ string) (bool, *auth.UserToken, error) {
				token.UnhashedToken = "new-token"
				return true, token, nil
			},
		}, nil, nil)

		sampleID := &authn.Identity{
			SessionToken: &auth.UserToken{
				Id:     1,
				UserId: 1,
			},
		}

		mockResponseWriter := &fakeResponseWriter{
			Status:      0,
			HeaderStore: map[string][]string{},
		}

		resp := &authn.Request{
			HTTPRequest: &http.Request{
				Header: map[string][]string{},
			},
			Resp: web.NewResponseWriter(http.MethodConnect, mockResponseWriter),
		}

		err := s.rotateTokenHook(context.Background(), sampleID, resp)
		require.NoError(t, err)

		resp.Resp.WriteHeader(201)
		require.Equal(t, 201, mockResponseWriter.Status)

		assert.Equal(t, "new-token", sampleID.SessionToken.UnhashedToken)
		require.Len(t, mockResponseWriter.HeaderStore, 1)
		assert.Equal(t, "grafana-session=new-token; Path=/; Max-Age=20; HttpOnly",
			mockResponseWriter.HeaderStore.Get("set-cookie"), mockResponseWriter.HeaderStore)
	})

	t.Run("should not rotate token with feature flag", func(t *testing.T) {
		s := ProvideSession(setting.NewCfg(), featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation), nil, nil, nil)

		req := &authn.Request{}
		identity := &authn.Identity{}
		err := s.Hook(context.Background(), identity, req)
		require.NoError(t, err)
	})
}

func TestSession_SyncOAuthTokenHook(t *testing.T) {
	type testCase struct {
		desc      string
		identity  *authn.Identity
		oauthInfo *social.OAuthInfo

		expectedHasEntryToken *login.UserAuth
		expectHasEntryCalled  bool

		expectedTryRefreshErr       error
		expectTryRefreshTokenCalled bool

		expectRevokeTokenCalled           bool
		expectInvalidateOauthTokensCalled bool

		expectedErr error
	}

	tests := []testCase{
		{
			desc:     "should skip sync when identity is not a user",
			identity: &authn.Identity{ID: "service-account:1"},
		},
		{
			desc:                 "should skip sync when user has session but is not authenticated with oauth",
			identity:             &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled: true,
		},
		{
			desc:                  "should skip sync for when access token don't have expire time",
			identity:              &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:  true,
			expectedHasEntryToken: &login.UserAuth{},
		},
		{
			desc:                  "should skip sync when access token has no expired yet",
			identity:              &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:  true,
			expectedHasEntryToken: &login.UserAuth{OAuthExpiry: time.Now().Add(10 * time.Minute)},
		},
		{
			desc:                  "should skip sync when access token has no expired yet",
			identity:              &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:  true,
			expectedHasEntryToken: &login.UserAuth{OAuthExpiry: time.Now().Add(10 * time.Minute)},
		},
		{
			desc:                        "should refresh access token when is has expired",
			identity:                    &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:        true,
			expectTryRefreshTokenCalled: true,
			expectedHasEntryToken:       &login.UserAuth{OAuthExpiry: time.Now().Add(-10 * time.Minute)},
		},
		{
			desc:                              "should invalidate access token and session token if access token can't be refreshed",
			identity:                          &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:              true,
			expectedTryRefreshErr:             errors.New("some err"),
			expectTryRefreshTokenCalled:       true,
			expectInvalidateOauthTokensCalled: true,
			expectRevokeTokenCalled:           true,
			expectedHasEntryToken:             &login.UserAuth{OAuthExpiry: time.Now().Add(-10 * time.Minute)},
			expectedErr:                       authn.ErrExpiredAccessToken,
		}, {
			desc:                        "should skip sync when use_refresh_token is disabled",
			identity:                    &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}, AuthenticatedBy: login.GitLabAuthModule},
			expectHasEntryCalled:        true,
			expectTryRefreshTokenCalled: false,
			expectedHasEntryToken:       &login.UserAuth{OAuthExpiry: time.Now().Add(-10 * time.Minute)},
			oauthInfo:                   &social.OAuthInfo{UseRefreshToken: false},
		},
		{
			desc:                        "should refresh access token when ID token has expired",
			identity:                    &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}},
			expectHasEntryCalled:        true,
			expectTryRefreshTokenCalled: true,
			expectedHasEntryToken:       &login.UserAuth{OAuthExpiry: time.Now().Add(10 * time.Minute), OAuthIdToken: fakeIDToken(t, time.Now().Add(-10*time.Minute))},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var (
				hasEntryCalled         bool
				tryRefreshCalled       bool
				invalidateTokensCalled bool
				revokeTokenCalled      bool
			)

			oauthTokenService := &oauthtokentest.MockOauthTokenService{
				HasOAuthEntryFunc: func(_ context.Context, _ identity.Requester) (*login.UserAuth, bool, error) {
					hasEntryCalled = true
					return tt.expectedHasEntryToken, tt.expectedHasEntryToken != nil, nil
				},
				InvalidateOAuthTokensFunc: func(_ context.Context, _ *login.UserAuth) error {
					invalidateTokensCalled = true
					return nil
				},
				TryTokenRefreshFunc: func(_ context.Context, _ *login.UserAuth) error {
					tryRefreshCalled = true
					return tt.expectedTryRefreshErr
				},
			}

			sessionService := &authtest.FakeUserAuthTokenService{
				RevokeTokenProvider: func(_ context.Context, _ *auth.UserToken, _ bool) error {
					revokeTokenCalled = true
					return nil
				},
			}

			if tt.oauthInfo == nil {
				tt.oauthInfo = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			}

			socialService := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthInfo,
			}

			client := ProvideSession(setting.NewCfg(), featuremgmt.WithFeatures(featuremgmt.FlagAccessTokenExpirationCheck), sessionService, oauthTokenService, socialService)

			err := client.syncOAuthTokenHook(context.Background(), tt.identity, nil)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.Equal(t, tt.expectHasEntryCalled, hasEntryCalled)
			assert.Equal(t, tt.expectTryRefreshTokenCalled, tryRefreshCalled)
			assert.Equal(t, tt.expectInvalidateOauthTokensCalled, invalidateTokensCalled)
			assert.Equal(t, tt.expectRevokeTokenCalled, revokeTokenCalled)
		})
	}
}

// fakeIDToken is used to create sa fake invalid token to verify expiry logic
func fakeIDToken(t *testing.T, expiryDate time.Time) string {
	type Header struct {
		Kid string `json:"kid"`
		Alg string `json:"alg"`
	}
	type Payload struct {
		Iss string `json:"iss"`
		Sub string `json:"sub"`
		Exp int64  `json:"exp"`
	}

	header, err := json.Marshal(Header{Kid: "123", Alg: "none"})
	require.NoError(t, err)
	u := expiryDate.UTC().Unix()
	payload, err := json.Marshal(Payload{Iss: "fake", Sub: "a-sub", Exp: u})
	require.NoError(t, err)

	fakeSignature := []byte("6ICJm")
	return fmt.Sprintf("%s.%s.%s", base64.RawURLEncoding.EncodeToString(header), base64.RawURLEncoding.EncodeToString(payload), base64.RawURLEncoding.EncodeToString(fakeSignature))
}

func TestGetOAuthTokenCacheTTL(t *testing.T) {
	defaultTime := time.Now()
	tests := []struct {
		name              string
		accessTokenExpiry time.Time
		idTokenExpiry     time.Time
		want              time.Duration
	}{
		{
			name:              "should return maxOAuthTokenCacheTTL when no expiry is given",
			accessTokenExpiry: time.Time{},
			idTokenExpiry:     time.Time{},

			want: maxOAuthTokenCacheTTL,
		},
		{
			name:              "should return maxOAuthTokenCacheTTL when access token is not given and id token expiry is greater than max cache ttl",
			accessTokenExpiry: time.Time{},
			idTokenExpiry:     defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),

			want: maxOAuthTokenCacheTTL,
		},
		{
			name:              "should return idTokenExpiry when access token is not given and id token expiry is less than max cache ttl",
			accessTokenExpiry: time.Time{},
			idTokenExpiry:     defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL),
			want:              time.Until(defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL)),
		},
		{
			name:              "should return maxOAuthTokenCacheTTL when access token expiry is greater than max cache ttl and id token is not given",
			accessTokenExpiry: defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),
			idTokenExpiry:     time.Time{},
			want:              maxOAuthTokenCacheTTL,
		},
		{
			name:              "should return accessTokenExpiry when access token expiry is less than max cache ttl and id token is not given",
			accessTokenExpiry: defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL),
			idTokenExpiry:     time.Time{},
			want:              time.Until(defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL)),
		},
		{
			name:              "should return accessTokenExpiry when access token expiry is less than max cache ttl and less than id token expiry",
			accessTokenExpiry: defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL),
			idTokenExpiry:     defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),
			want:              time.Until(defaultTime.Add(-5*time.Minute + maxOAuthTokenCacheTTL)),
		},
		{
			name:              "should return idTokenExpiry when id token expiry is less than max cache ttl and less than access token expiry",
			accessTokenExpiry: defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),
			idTokenExpiry:     defaultTime.Add(-3*time.Minute + maxOAuthTokenCacheTTL),
			want:              time.Until(defaultTime.Add(-3*time.Minute + maxOAuthTokenCacheTTL)),
		},
		{
			name:              "should return maxOAuthTokenCacheTTL when access token expiry is greater than max cache ttl and id token expiry is greater than max cache ttl",
			accessTokenExpiry: defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),
			idTokenExpiry:     defaultTime.Add(5*time.Minute + maxOAuthTokenCacheTTL),
			want:              maxOAuthTokenCacheTTL,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getOAuthTokenCacheTTL(tt.accessTokenExpiry, tt.idTokenExpiry)

			assert.Equal(t, tt.want.Round(time.Second), got.Round(time.Second))
		})
	}
}
