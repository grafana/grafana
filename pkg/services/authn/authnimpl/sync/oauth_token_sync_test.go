package sync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestOauthTokenSync_SyncOAuthTokenHook(t *testing.T) {
	type testCase struct {
		desc     string
		identity *authn.Identity

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
			expectedErr:                       errExpiredAccessToken,
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
				HasOAuthEntryFunc: func(ctx context.Context, usr *user.SignedInUser) (*login.UserAuth, bool, error) {
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

			sync := &OAuthTokenSync{
				log:            log.NewNopLogger(),
				cache:          localcache.New(0, 0),
				service:        service,
				sessionService: sessionService,
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
