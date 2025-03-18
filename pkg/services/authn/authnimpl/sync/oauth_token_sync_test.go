package sync

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/stretchr/testify/assert"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
)

func TestOAuthTokenSync_SyncOAuthTokenHook(t *testing.T) {
	type testCase struct {
		desc      string
		identity  *authn.Identity
		oauthInfo *social.OAuthInfo

		expectToken *login.UserAuth

		expectedTryRefreshErr       error
		expectTryRefreshTokenCalled bool

		expectRevokeTokenCalled bool

		expectedErr error
	}

	tests := []testCase{
		{
			desc:                        "should skip sync when identity is not a user",
			identity:                    &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
			expectTryRefreshTokenCalled: false,
		},
		{
			desc:                        "should skip sync when identity is a user but is not authenticated with session token",
			identity:                    &authn.Identity{ID: "1", Type: claims.TypeUser},
			expectTryRefreshTokenCalled: false,
		},
		{
			desc:                        "should invalidate access token and session token if token refresh fails",
			identity:                    &authn.Identity{ID: "1", Type: claims.TypeUser, SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectedTryRefreshErr:       errors.New("some err"),
			expectTryRefreshTokenCalled: true,
			expectRevokeTokenCalled:     true,
			expectToken:                 &login.UserAuth{OAuthExpiry: time.Now().Add(-10 * time.Minute)},
			expectedErr:                 authn.ErrExpiredAccessToken,
		},
		{
			desc:                        "should refresh the token successfully",
			identity:                    &authn.Identity{ID: "1", Type: claims.TypeUser, SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectTryRefreshTokenCalled: true,
			expectRevokeTokenCalled:     false,
		},
		{
			desc:                        "should not invalidate the token if the token has already been refreshed by another request (singleflight)",
			identity:                    &authn.Identity{ID: "1", Type: claims.TypeUser, SessionToken: &auth.UserToken{}, AuthenticatedBy: login.AzureADAuthModule},
			expectTryRefreshTokenCalled: true,
			expectRevokeTokenCalled:     false,
			expectToken:                 &login.UserAuth{OAuthExpiry: time.Now().Add(10 * time.Minute)},
		},

		// TODO: address coverage of oauthtoken sync
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var (
				tryRefreshCalled  bool
				revokeTokenCalled bool
			)

			service := &oauthtokentest.MockOauthTokenService{
				TryTokenRefreshFunc: func(ctx context.Context, usr identity.Requester, _ *auth.UserToken) (*oauth2.Token, error) {
					tryRefreshCalled = true
					return nil, tt.expectedTryRefreshErr
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
				tracer:            tracing.InitializeTracerForTest(),
				cache:             localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
				features:          featuremgmt.WithFeatures(),
			}

			ctx := context.Background()
			reqCtx := context.WithValue(ctx, ctxkey.Key{}, &contextmodel.ReqContext{UserToken: nil})

			err := sync.SyncOauthTokenHook(reqCtx, tt.identity, nil)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.Equal(t, tt.expectTryRefreshTokenCalled, tryRefreshCalled)
			assert.Equal(t, tt.expectRevokeTokenCalled, revokeTokenCalled)
		})
	}
}
