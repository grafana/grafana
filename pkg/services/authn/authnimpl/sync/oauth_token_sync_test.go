package sync

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/socialtest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
)

func TestOAuthTokenSync_SyncOAuthTokenHook(t *testing.T) {
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
			desc:     "should skip sync when identity is a user but is not authenticated with session token",
			identity: &authn.Identity{ID: "user:1"},
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

			service := &oauthtokentest.MockOauthTokenService{
				HasOAuthEntryFunc: func(ctx context.Context, usr identity.Requester) (*login.UserAuth, bool, error) {
					hasEntryCalled = true
					return tt.expectedHasEntryToken, tt.expectedHasEntryToken != nil, nil
				},
				InvalidateOAuthTokensFunc: func(ctx context.Context, usr *login.UserAuth) error {
					invalidateTokensCalled = true
					return nil
				},
				TryTokenRefreshFunc: func(ctx context.Context, usr *login.UserAuth) error {
					tryRefreshCalled = true
					return tt.expectedTryRefreshErr
				},
			}

			sessionService := &authtest.FakeUserAuthTokenService{
				RevokeTokenProvider: func(ctx context.Context, token *auth.UserToken, soft bool) error {
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

			sync := &OAuthTokenSync{
				log:            log.NewNopLogger(),
				cache:          localcache.New(0, 0),
				service:        service,
				sessionService: sessionService,
				socialService:  socialService,
			}

			err := sync.SyncOauthTokenHook(context.Background(), tt.identity, nil)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.Equal(t, tt.expectHasEntryCalled, hasEntryCalled)
			assert.Equal(t, tt.expectTryRefreshTokenCalled, tryRefreshCalled)
			assert.Equal(t, tt.expectInvalidateOauthTokensCalled, invalidateTokensCalled)
			assert.Equal(t, tt.expectRevokeTokenCalled, revokeTokenCalled)
		})
	}
}

// fakeIDToken is used to create a fake invalid token to verify expiry logic
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

func TestOAuthTokenSync_getOAuthTokenCacheTTL(t *testing.T) {
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
