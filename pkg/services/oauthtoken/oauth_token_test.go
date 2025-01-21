package oauthtoken

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

const EXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6InlvdXItY2xpZW50LWlkIiwiZXhwIjoxNjAwMDAwMDAwLCJpYXQiOjE2MDAwMDAwMDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl" // #nosec G101 not a hardcoded credential

const UNEXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6InlvdXItY2xpZW50LWlkIiwiZXhwIjo0ODg1NjA4MDAwLCJpYXQiOjE2ODU2MDgwMDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl" // #nosec G101 not a hardcoded credential

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

type FakeAuthInfoStore struct {
	login.Store
	ExpectedError error
	ExpectedOAuth *login.UserAuth
}

func (f *FakeAuthInfoStore) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) (*login.UserAuth, error) {
	return f.ExpectedOAuth, f.ExpectedError
}

func (f *FakeAuthInfoStore) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) UpdateAuthInfo(ctx context.Context, cmd *login.UpdateAuthInfoCommand) error {
	f.ExpectedOAuth.OAuthAccessToken = cmd.OAuthToken.AccessToken
	f.ExpectedOAuth.OAuthExpiry = cmd.OAuthToken.Expiry
	f.ExpectedOAuth.OAuthTokenType = cmd.OAuthToken.TokenType
	f.ExpectedOAuth.OAuthRefreshToken = cmd.OAuthToken.RefreshToken
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) DeleteAuthInfo(ctx context.Context, cmd *login.DeleteAuthInfoCommand) error {
	return f.ExpectedError
}

func TestIntegration_TryTokenRefresh(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	unexpiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(time.Hour),
		TokenType:    "Bearer",
	}
	unexpiredTokenWithIDToken := unexpiredToken.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	expiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}

	type environment struct {
		sessionService  *authtest.MockUserAuthTokenService
		authInfoService *authinfotest.FakeService
		serverLock      *serverlock.ServerLockService
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		store   db.DB
		service *Service
	}

	type testCase struct {
		desc          string
		identity      identity.Requester
		setup         func(env *environment)
		expectedToken *oauth2.Token
		expectedErr   error
	}

	userIdentity := &authn.Identity{
		AuthenticatedBy: login.GenericOAuthModule,
		ID:              "1234",
		Type:            claims.TypeUser,
	}

	tests := []testCase{
		{
			desc: "should skip sync when identity is nil",
		},
		{
			desc:     "should skip sync when identity is not a user",
			identity: &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
		},
		{
			desc:     "should skip token refresh and return nil if namespace and id cannot be converted to user ID",
			identity: &authn.Identity{ID: "invalid", Type: claims.TypeUser},
		},
		{
			desc:     "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedError = errors.New("some error")
			},
		},
		{
			desc:     "should skip token refresh if the user doesn't have an oauth entry",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.SAMLAuthModule,
				}
			},
		},
		{
			desc:     "should skip token refresh when no oauth provider was found",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}
			},
		},
		{
			desc:     "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc:     "should skip token refresh when the token is still valid and no id token is present",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
				}

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc:     "should not refresh the tokens if access token or id token have not expired yet",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      UNEXPIRED_ID_TOKEN,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
				}

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should skip token refresh when there is no refresh token",
			identity: userIdentity,
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: "",
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: &oauth2.Token{
				AccessToken:  unexpiredTokenWithIDToken.AccessToken,
				RefreshToken: "",
				Expiry:       unexpiredTokenWithIDToken.Expiry,
			},
		},
		{
			desc:     "should do token refresh when the token is expired",
			identity: userIdentity,
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}
				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should refresh token when the id token is expired",
			identity: &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}
				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should return ErrRetriesExhausted when lock cannot be acquired",
			identity: &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1234,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}
				_ = env.store.WithDbSession(context.Background(), func(sess *db.Session) error {
					_, err := sess.Exec(`INSERT INTO server_lock (operation_uid, last_execution, version) VALUES (?, ?, ?)`, "oauth-refresh-token-1234", time.Now().Add(2*time.Second).Unix(), 0)
					return err
				})
			},
			expectedErr: ErrRetriesExhausted,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := socialtest.NewMockSocialConnector(t)

			store := db.InitTestDB(t)

			env := environment{
				sessionService:  authtest.NewMockUserAuthTokenService(t),
				authInfoService: &authinfotest.FakeService{},
				serverLock:      serverlock.ProvideService(store, tracing.InitializeTracerForTest()),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
				store: store,
			}

			if tt.setup != nil {
				tt.setup(&env)
			}

			env.service = ProvideService(
				env.socialService,
				env.authInfoService,
				setting.NewCfg(),
				prometheus.NewRegistry(),
				env.serverLock,
				tracing.InitializeTracerForTest(),
				env.sessionService,
				featuremgmt.WithFeatures(),
			)

			// token refresh
			actualToken, err := env.service.TryTokenRefresh(context.Background(), tt.identity, &usertoken.UserToken{ExternalSessionId: 1})

			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				return
			}

			if tt.expectedToken == nil {
				assert.Nil(t, actualToken)
				return
			}

			assert.Equal(t, tt.expectedToken.AccessToken, actualToken.AccessToken)
			assert.Equal(t, tt.expectedToken.RefreshToken, actualToken.RefreshToken)
			assert.Equal(t, tt.expectedToken.Expiry, actualToken.Expiry)
			assert.Equal(t, tt.expectedToken.TokenType, actualToken.TokenType)
			if tt.expectedToken.Extra("id_token") != nil {
				assert.Equal(t, tt.expectedToken.Extra("id_token").(string), actualToken.Extra("id_token").(string))
			} else {
				assert.Nil(t, actualToken.Extra("id_token"))
			}
		})
	}
}

func TestIntegration_TryTokenRefresh_WithExternalSessions(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test")
	}

	unexpiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(time.Hour),
		TokenType:    "Bearer",
	}
	unexpiredTokenWithIDToken := unexpiredToken.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	expiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}

	userIdentity := &authn.Identity{
		AuthenticatedBy: login.GenericOAuthModule,
		ID:              "1234",
		Type:            claims.TypeUser,
	}

	type environment struct {
		sessionService  *authtest.MockUserAuthTokenService
		serverLock      *serverlock.ServerLockService
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		store   db.DB
		service *Service
	}

	type testCase struct {
		desc          string
		identity      identity.Requester
		setup         func(env *environment)
		expectedToken *oauth2.Token
		expectedErr   error
	}

	tests := []testCase{
		{
			desc: "should skip sync when identity is nil",
		},
		{
			desc:     "should skip sync when identity is not a user",
			identity: &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
		},
		{
			desc:     "should skip token refresh and return nil if namespace and id cannot be converted to user ID",
			identity: &authn.Identity{ID: "invalid", Type: claims.TypeUser},
		},
		{
			desc:     "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, assert.AnError).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		// Kinda impossible to happen, can only happen after the feature is enabled and logged in users don't have their external sessions set
		{
			desc:     "should skip token refresh if the user doesn't have an external session",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, auth.ErrExternalSessionNotFound).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc:     "should skip token refresh when no oauth provider was found",
			identity: userIdentity,
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = nil
			},
		},
		{
			desc:     "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity: userIdentity,
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc:     "should skip token refresh when the token is still valid and no id token is present",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredTokenWithIDToken.AccessToken,
					RefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					ExpiresAt:    unexpiredTokenWithIDToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc:     "should not do token refresh if access token or id token have not expired yet",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredTokenWithIDToken.AccessToken,
					RefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					ExpiresAt:    unexpiredTokenWithIDToken.Expiry,
					IDToken:      UNEXPIRED_ID_TOKEN,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should skip token refresh when there is no refresh token",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredTokenWithIDToken.AccessToken,
					RefreshToken: "",
					ExpiresAt:    unexpiredTokenWithIDToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: &oauth2.Token{
				AccessToken:  unexpiredTokenWithIDToken.AccessToken,
				RefreshToken: "",
				Expiry:       unexpiredTokenWithIDToken.Expiry,
			},
		},
		{
			desc: "should refresh token when the access token is expired",
			identity: &authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  expiredToken.AccessToken,
					IDToken:      UNEXPIRED_ID_TOKEN,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
				}, nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should refresh token when the id token is expired",
			identity: userIdentity,
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredTokenWithIDToken.AccessToken,
					RefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					ExpiresAt:    unexpiredTokenWithIDToken.Expiry,
					IDToken:      EXPIRED_ID_TOKEN,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should return ErrRetriesExhausted when lock cannot be acquired",
			identity: &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}

				_ = env.store.WithDbSession(context.Background(), func(sess *db.Session) error {
					_, err := sess.Exec(`INSERT INTO server_lock (operation_uid, last_execution, version) VALUES (?, ?, ?)`, "oauth-refresh-token-1234-1", time.Now().Add(2*time.Second).Unix(), 0)
					return err
				})
			},
			expectedErr: ErrRetriesExhausted,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := socialtest.NewMockSocialConnector(t)

			store := db.InitTestDB(t)

			env := environment{
				sessionService:  authtest.NewMockUserAuthTokenService(t),
				serverLock:      serverlock.ProvideService(store, tracing.InitializeTracerForTest()),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
				store: store,
			}

			if tt.setup != nil {
				tt.setup(&env)
			}

			env.service = ProvideService(
				env.socialService,
				nil,
				setting.NewCfg(),
				prometheus.NewRegistry(),
				env.serverLock,
				tracing.InitializeTracerForTest(),
				env.sessionService,
				featuremgmt.WithFeatures(featuremgmt.FlagImprovedExternalSessionHandling),
			)

			// token refresh
			actualToken, err := env.service.TryTokenRefresh(context.Background(), tt.identity, &usertoken.UserToken{ExternalSessionId: 1})

			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				return
			}

			assert.NoError(t, err)

			if tt.expectedToken == nil {
				assert.Nil(t, actualToken)
				return
			}

			assert.Equal(t, tt.expectedToken.AccessToken, actualToken.AccessToken)
			assert.Equal(t, tt.expectedToken.RefreshToken, actualToken.RefreshToken)
			assert.Equal(t, tt.expectedToken.Expiry, actualToken.Expiry)
			if tt.expectedToken.Extra("id_token") != nil {
				assert.Equal(t, tt.expectedToken.Extra("id_token").(string), actualToken.Extra("id_token").(string))
			} else {
				assert.Nil(t, actualToken.Extra("id_token"))
			}
		})
	}
}

func verifyUpdateExternalSessionCommand(token *oauth2.Token) func(*auth.UpdateExternalSessionCommand) bool {
	return func(cmd *auth.UpdateExternalSessionCommand) bool {
		idToken := cmd.Token.Extra("id_token")
		return cmd.Token.AccessToken == token.AccessToken &&
			cmd.Token.RefreshToken == token.RefreshToken &&
			cmd.Token.Expiry == token.Expiry &&
			idToken == token.Extra("id_token")
	}
}

func TestOAuthTokenSync_needTokenRefresh(t *testing.T) {
	tests := []struct {
		name                     string
		usr                      *login.UserAuth
		expectedTokenRefreshFlag bool
		expectedTokenDuration    time.Duration
	}{
		{
			name:                     "should not need token refresh when token has no expiration date",
			usr:                      &login.UserAuth{},
			expectedTokenRefreshFlag: false,
		},
		{
			name: "should not need token refresh with an invalid jwt token that might result in an error when parsing",
			usr: &login.UserAuth{
				OAuthIdToken: "invalid_jwt_format",
			},
			expectedTokenRefreshFlag: false,
		},
		{
			name: "should flag token refresh with id token is expired",
			usr: &login.UserAuth{
				OAuthIdToken: EXPIRED_ID_TOKEN,
			},
			expectedTokenRefreshFlag: true,
			expectedTokenDuration:    time.Second,
		},
		{
			name: "should flag token refresh when expiry date is zero",
			usr: &login.UserAuth{
				OAuthExpiry: time.Unix(0, 0),
			},
			expectedTokenRefreshFlag: true,
			expectedTokenDuration:    time.Second,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := buildOAuthTokenFromAuthInfo(tt.usr)
			needsTokenRefresh := needTokenRefresh(context.Background(), token)

			assert.Equal(t, tt.expectedTokenRefreshFlag, needsTokenRefresh)
		})
	}
}
