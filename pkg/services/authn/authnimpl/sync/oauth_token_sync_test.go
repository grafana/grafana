package sync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
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
			desc:                        "should skip sync when identity is not a user",
			identity:                    &authn.Identity{ID: "service-account:1"},
			expectTryRefreshTokenCalled: false,
		},
		{
			desc:                        "should skip sync when identity is a user but is not authenticated with session token",
			identity:                    &authn.Identity{ID: "user:1"},
			expectTryRefreshTokenCalled: false,
		},
		{
			desc:                              "should invalidate access token and session token if token refresh fails",
			identity:                          &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectHasEntryCalled:              true,
			expectedTryRefreshErr:             errors.New("some err"),
			expectTryRefreshTokenCalled:       true,
			expectInvalidateOauthTokensCalled: true,
			expectRevokeTokenCalled:           true,
			expectedHasEntryToken:             &login.UserAuth{OAuthExpiry: time.Now().Add(-10 * time.Minute)},
			expectedErr:                       authn.ErrExpiredAccessToken,
		},
		{
			desc:                              "should refresh the token successfully",
			identity:                          &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectHasEntryCalled:              false,
			expectTryRefreshTokenCalled:       true,
			expectInvalidateOauthTokensCalled: false,
			expectRevokeTokenCalled:           false,
		},
		{
			desc:                              "should not invalidate the token if the token has already been refreshed by another request (singleflight)",
			identity:                          &authn.Identity{ID: "user:1", SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectHasEntryCalled:              true,
			expectTryRefreshTokenCalled:       true,
			expectInvalidateOauthTokensCalled: false,
			expectRevokeTokenCalled:           false,
			expectedHasEntryToken:             &login.UserAuth{OAuthExpiry: time.Now().Add(10 * time.Minute)},
			expectedTryRefreshErr:             errors.New("some err"),
		},

		// TODO: address coverage of oauthtoken sync
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
				TryTokenRefreshFunc: func(ctx context.Context, usr identity.Requester) error {
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
				log:               log.NewNopLogger(),
				service:           service,
				sessionService:    sessionService,
				socialService:     socialService,
				singleflightGroup: new(singleflight.Group),
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
