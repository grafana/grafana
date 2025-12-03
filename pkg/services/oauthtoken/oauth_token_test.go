package oauthtoken

import (
	"context"
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
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

const EXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6InlvdXItY2xpZW50LWlkIiwiZXhwIjoxNjAwMDAwMDAwLCJpYXQiOjE2MDAwMDAwMDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl" // #nosec G101 not a hardcoded credential

const UNEXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6InlvdXItY2xpZW50LWlkIiwiZXhwIjo0ODg1NjA4MDAwLCJpYXQiOjE2ODU2MDgwMDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9.c2lnbmF0dXJl" // #nosec G101 not a hardcoded credential

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var (
	unexpiredTokenWithoutRefresh = &oauth2.Token{
		AccessToken: "testaccess",
		Expiry:      time.Now().Add(time.Hour),
		TokenType:   "Bearer",
	}

	unexpiredTokenWithoutRefreshWithIDToken = unexpiredTokenWithoutRefresh.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	unexpiredToken = &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(time.Hour),
		TokenType:    "Bearer",
	}

	unexpiredTokenWithIDToken = unexpiredToken.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	expiredToken = &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}
)

type environment struct {
	sessionService  *authtest.MockUserAuthTokenService
	authInfoService *authinfotest.MockAuthInfoService
	serverLock      *serverlock.ServerLockService
	socialConnector *socialtest.MockSocialConnector
	socialService   *socialtest.FakeSocialService

	store   db.DB
	service *Service
}

func TestIntegration_TryTokenRefresh(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type testCase struct {
		desc            string
		identity        identity.Requester
		refreshMetadata *TokenRefreshMetadata
		setup           func(env *environment)
		expectedToken   *oauth2.Token
		expectedErr     error
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
			desc:            "should skip token refresh when no oauth provider was found",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.SAMLAuthModule},
		},
		{
			desc:            "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc:            "should skip token refresh if there's an unexpected error while looking up the user auth entry, additionally, no error should be returned",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(nil, assert.AnError).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc:            "should skip token refresh when there is no refresh token and the provider does not require one",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
			expectedToken: nil,
		},
		{
			desc:            "should return error when there is no refresh token and provider requires one",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: "",
					OAuthExpiry:       expiredToken.Expiry,
				}, nil)

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: nil,
			expectedErr:   ErrNoRefreshTokenFound,
		},
		{
			desc:            "should skip token refresh when the token is still valid and no id token is present",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
				}, nil)

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc:            "should not refresh the tokens if access token or id token have not expired yet",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      UNEXPIRED_ID_TOKEN,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
				}, nil)

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:            "should do token refresh when the token is expired",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1234 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:            "should refresh token when the id token is expired",
			identity:        &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1234 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:            "should return ErrRetriesExhausted when lock cannot be acquired",
			identity:        &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}

				_ = env.store.WithDbSession(context.Background(), func(sess *db.Session) error {
					_, err := sess.Exec(`INSERT INTO server_lock (operation_uid, last_execution, version) VALUES (?, ?, ?)`, "oauth-refresh-token-1234", time.Now().Add(2*time.Second).Unix(), 0)
					return err
				})
			},
			expectedErr: ErrRetriesExhausted,
		},
		{
			desc: "should be able to refresh token when the caller is render service and the access token is expired",
			identity: &authn.Identity{
				AuthenticatedBy: login.RenderModule,
				ID:              "1",
				Type:            claims.TypeUser,
			},
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.MatchedBy(func(query *login.GetAuthInfoQuery) bool {
					return query.UserId == 1
				})).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil).Once()
				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()
				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()
				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := socialtest.NewMockSocialConnector(t)

			store := db.InitTestDB(t)

			env := environment{
				sessionService:  authtest.NewMockUserAuthTokenService(t),
				authInfoService: authinfotest.NewMockAuthInfoService(t),
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
			actualToken, err := env.service.TryTokenRefresh(context.Background(), tt.identity, tt.refreshMetadata)

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
	testutil.SkipIntegrationTestInShortMode(t)

	userIdentity := &authn.Identity{
		AuthenticatedBy: login.GenericOAuthModule,
		ID:              "1234",
		Type:            claims.TypeUser,
	}

	type testCase struct {
		desc            string
		identity        identity.Requester
		refreshMetadata *TokenRefreshMetadata
		setup           func(env *environment)
		expectedToken   *oauth2.Token
		expectedErr     error
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
			desc:            "should skip token refresh when no oauth provider was found",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.SAMLAuthModule},
		},
		{
			desc:            "should skip token refresh if there's an unexpected error while looking up the external session entry, additionally, no error should be returned",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, assert.AnError).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		// Edge case, can only happen after the feature is enabled and logged in users don't have their external sessions set
		{
			desc:            "should skip token refresh if the user doesn't have an external session",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, auth.ErrExternalSessionNotFound).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc:            "should skip token refresh when no oauth provider was found",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = nil
			},
		},
		{
			desc:            "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc:            "should skip token refresh when the token is still valid and no id token is present",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
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
			desc:            "should skip token refresh when there is no refresh token and the provider does not require one",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
			expectedToken: nil,
		},
		{
			desc:            "should return error when there is no refresh token and provider requires one",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: "",
					ExpiresAt:    expiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: nil,
			expectedErr:   ErrNoRefreshTokenFound,
		},
		{
			desc:            "should not do token refresh if access token or id token have not expired yet",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
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
			desc:            "should refresh token when the access token is expired",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      UNEXPIRED_ID_TOKEN,
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
			desc:            "should refresh token when the id token is expired",
			identity:        userIdentity,
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
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
			desc:            "should be able to refresh token when the caller is render service and the access token is expired",
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
			identity: &authn.Identity{
				AuthenticatedBy: login.RenderModule,
				ID:              "1",
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AuthModule:   login.RenderModule,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      UNEXPIRED_ID_TOKEN,
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
			desc:            "should return ErrRetriesExhausted when lock cannot be acquired",
			identity:        &authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			refreshMetadata: &TokenRefreshMetadata{ExternalSessionID: 1, AuthModule: login.GenericOAuthModule},
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
				authInfoService: authinfotest.NewMockAuthInfoService(t),
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
				featuremgmt.WithFeatures(featuremgmt.FlagImprovedExternalSessionHandling),
			)

			// token refresh
			actualToken, err := env.service.TryTokenRefresh(context.Background(), tt.identity, tt.refreshMetadata)

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
			cmd.Token.Expiry.Equal(token.Expiry) &&
			idToken == token.Extra("id_token")
	}
}

func TestOAuthTokenSync_needTokenRefresh(t *testing.T) {
	tests := []struct {
		name                     string
		token                    *oauth2.Token
		expectedTokenRefreshFlag bool
		expectedTokenDuration    time.Duration
	}{
		{
			name: "should not need token refresh when token has no expiration date",
			token: &oauth2.Token{
				AccessToken: "some_access_token",
				Expiry:      time.Time{},
			},
			expectedTokenRefreshFlag: false,
		},
		{
			name: "should not need token refresh with an invalid jwt token that might result in an error when parsing",
			token: (&oauth2.Token{
				AccessToken: "some_access_token",
			}).WithExtra(map[string]any{"id_token": "invalid_jwt_format"}),
			expectedTokenRefreshFlag: false,
		},
		{
			name: "should flag token refresh when access token is empty",
			token: &oauth2.Token{
				AccessToken: "",
			},
			expectedTokenRefreshFlag: true,
		},
		{
			name: "should flag token refresh with id token is expired",
			token: (&oauth2.Token{
				AccessToken: "some_access_token"}).WithExtra(map[string]any{"id_token": EXPIRED_ID_TOKEN}),
			expectedTokenRefreshFlag: true,
			expectedTokenDuration:    time.Second,
		},
		{
			name: "should flag token refresh when expiry date is zero",
			token: &oauth2.Token{
				AccessToken: "some_access_token",
				Expiry:      time.Unix(0, 0),
			},
			expectedTokenRefreshFlag: true,
			expectedTokenDuration:    time.Second,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			needsTokenRefresh := needTokenRefresh(context.Background(), tt.token)

			assert.Equal(t, tt.expectedTokenRefreshFlag, needsTokenRefresh)
		})
	}
}

func TestIntegration_GetCurrentOAuthToken(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type testCase struct {
		desc          string
		identity      identity.Requester
		sessionToken  *auth.UserToken
		setup         func(env *environment)
		expectedToken *oauth2.Token
	}

	userIdentity := &authn.Identity{
		AuthenticatedBy: login.GenericOAuthModule,
		ID:              "1234",
		Type:            claims.TypeUser,
	}

	tests := []testCase{
		{
			desc:          "should return nil when identity is nil",
			identity:      nil,
			expectedToken: nil,
		},
		{
			desc:          "should return nil when identity is not a user",
			identity:      &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
			expectedToken: nil,
		},
		{
			desc:     "should refresh token for render service user",
			identity: &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: login.RenderModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.sessionService.On("FindExternalSessions", mock.Anything, &auth.ListExternalSessionQuery{UserID: 1}).Return([]*auth.ExternalSession{
					{
						ID:           1,
						UserID:       1,
						AuthModule:   login.GenericOAuthModule,
						AccessToken:  expiredToken.AccessToken,
						RefreshToken: expiredToken.RefreshToken,
						ExpiresAt:    expiredToken.Expiry,
						IDToken:      EXPIRED_ID_TOKEN,
					},
				}, nil).Once()

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should refresh token for render service user with multiple external sessions",
			identity: &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: login.RenderModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				// Return multiple external sessions, the most recent one is returned first by the query
				env.sessionService.On("FindExternalSessions", mock.Anything, &auth.ListExternalSessionQuery{UserID: 1}).Return([]*auth.ExternalSession{
					{
						ID:           2, // newer session
						UserID:       1,
						AuthModule:   login.GenericOAuthModule,
						AccessToken:  expiredToken.AccessToken,
						RefreshToken: expiredToken.RefreshToken,
						ExpiresAt:    expiredToken.Expiry,
						IDToken:      EXPIRED_ID_TOKEN,
					},
					{
						ID:         1, // older session
						UserID:     1,
						AuthModule: login.GenericOAuthModule,
					}}, nil).Once()

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(2), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should skip token refresh when the token is still valid and no id token is present",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  unexpiredToken.AccessToken,
					OAuthRefreshToken: unexpiredToken.RefreshToken,
					OAuthExpiry:       unexpiredToken.Expiry,
					OAuthTokenType:    unexpiredToken.TokenType,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc:         "should not do token refresh if access token or id token have not expired yet",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      UNEXPIRED_ID_TOKEN,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should return the unexpired access and id token when token refresh is disabled",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:       login.GenericOAuthModule,
					OAuthIdToken:     UNEXPIRED_ID_TOKEN,
					OAuthAccessToken: unexpiredTokenWithIDToken.AccessToken,
					OAuthExpiry:      unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:   unexpiredTokenWithIDToken.TokenType,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:          1,
					UserID:      1234,
					AuthModule:  login.GenericOAuthModule,
					AccessToken: unexpiredToken.AccessToken,
					ExpiresAt:   unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
			expectedToken: unexpiredTokenWithoutRefreshWithIDToken,
		},
		// Edge case, can only happen after the feature is enabled and logged in users don't have their external sessions set,
		{
			desc:         "should refresh token when the access token is expired and the external session was not found",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1234,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, auth.ErrExternalSessionNotFound).Once()

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1234 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should refresh token when the access token is expired",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1234,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      UNEXPIRED_ID_TOKEN,
				}, nil).Once()

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1234 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should refresh token when the id token is expired",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1234,
					OAuthAccessToken:  unexpiredTokenWithIDToken.AccessToken,
					OAuthRefreshToken: unexpiredTokenWithIDToken.RefreshToken,
					OAuthExpiry:       unexpiredTokenWithIDToken.Expiry,
					OAuthTokenType:    unexpiredTokenWithIDToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
					IDToken:      EXPIRED_ID_TOKEN,
				}, nil).Once()

				env.authInfoService.On("UpdateAuthInfo", mock.Anything, mock.MatchedBy(func(cmd *login.UpdateAuthInfoCommand) bool {
					return cmd.UserId == 1234 && cmd.AuthModule == login.GenericOAuthModule &&
						cmd.OAuthToken.AccessToken == unexpiredTokenWithIDToken.AccessToken &&
						cmd.OAuthToken.RefreshToken == unexpiredTokenWithIDToken.RefreshToken &&
						cmd.OAuthToken.Expiry.Equal(unexpiredTokenWithIDToken.Expiry) &&
						cmd.OAuthToken.TokenType == unexpiredTokenWithIDToken.TokenType
				})).Return(nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := socialtest.NewMockSocialConnector(t)
			store := db.InitTestDB(t)
			features := featuremgmt.WithFeatures()

			env := environment{
				sessionService:  authtest.NewMockUserAuthTokenService(t),
				authInfoService: authinfotest.NewMockAuthInfoService(t),
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
				features,
			)

			actualToken := env.service.GetCurrentOAuthToken(context.Background(), tt.identity, tt.sessionToken)

			if tt.expectedToken == nil {
				assert.Nil(t, actualToken)
				return
			}

			assert.NotNil(t, actualToken)
			assert.Equal(t, tt.expectedToken.AccessToken, actualToken.AccessToken)
			assert.Equal(t, tt.expectedToken.RefreshToken, actualToken.RefreshToken)
			assert.WithinDuration(t, tt.expectedToken.Expiry, actualToken.Expiry, time.Second)
			assert.Equal(t, tt.expectedToken.TokenType, actualToken.TokenType)
			if tt.expectedToken.Extra("id_token") != nil {
				assert.Equal(t, tt.expectedToken.Extra("id_token"), actualToken.Extra("id_token"))
			} else {
				assert.Nil(t, actualToken.Extra("id_token"))
			}
		})
	}
}

func TestIntegration_GetCurrentOAuthToken_WithExternalSessions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	type testCase struct {
		desc          string
		identity      identity.Requester
		sessionToken  *auth.UserToken
		setup         func(env *environment)
		expectedToken *oauth2.Token
	}

	userIdentity := &authn.Identity{
		AuthenticatedBy: login.GenericOAuthModule,
		ID:              "1234",
		Type:            claims.TypeUser,
	}

	tests := []testCase{
		{
			desc:          "should return nil when identity is nil",
			identity:      nil,
			expectedToken: nil,
		},
		{
			desc:          "should return nil when identity is not a user",
			identity:      &authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
			expectedToken: nil,
		},
		{
			desc:     "should refresh token for render service user",
			identity: &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: login.RenderModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(3)).Return(&auth.ExternalSession{
					ID:           3,
					UserID:       1,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      EXPIRED_ID_TOKEN,
				}, nil).Once()

				env.sessionService.On("FindExternalSessions", mock.Anything, &auth.ListExternalSessionQuery{UserID: 1}).Return([]*auth.ExternalSession{
					{
						ID:           3,
						UserID:       1,
						AuthModule:   login.GenericOAuthModule,
						AccessToken:  expiredToken.AccessToken,
						RefreshToken: expiredToken.RefreshToken,
						ExpiresAt:    expiredToken.Expiry,
						IDToken:      EXPIRED_ID_TOKEN,
					},
				}, nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(3), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:     "should refresh token for render service user with multiple external sessions",
			identity: &authn.Identity{ID: "1", Type: claims.TypeUser, AuthenticatedBy: login.RenderModule},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  expiredToken.AccessToken,
					OAuthRefreshToken: expiredToken.RefreshToken,
					OAuthExpiry:       expiredToken.Expiry,
					OAuthTokenType:    expiredToken.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}, nil)

				// Return multiple external sessions, the most recent one is returned first by the query
				env.sessionService.On("FindExternalSessions", mock.Anything, &auth.ListExternalSessionQuery{UserID: 1}).Return([]*auth.ExternalSession{
					{
						ID:           2, // newer session
						UserID:       1,
						AuthModule:   login.GenericOAuthModule,
						AccessToken:  expiredToken.AccessToken,
						RefreshToken: expiredToken.RefreshToken,
						ExpiresAt:    expiredToken.Expiry,
						IDToken:      EXPIRED_ID_TOKEN,
					},
					{
						ID:         1, // older session
						UserID:     1,
						AuthModule: login.GenericOAuthModule,
					}}, nil).Once()

				env.sessionService.On("GetExternalSession", mock.Anything, int64(2)).Return(&auth.ExternalSession{
					ID:           2,
					UserID:       1,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      EXPIRED_ID_TOKEN,
				}, nil).Once()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(2), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should skip token refresh when the token is still valid and no id token is present",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc:         "should return the unexpired access and id token when token refresh is disabled",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:          1,
					UserID:      1234,
					AuthModule:  login.GenericOAuthModule,
					AccessToken: unexpiredTokenWithIDToken.AccessToken,
					ExpiresAt:   unexpiredTokenWithIDToken.Expiry,
					IDToken:     UNEXPIRED_ID_TOKEN,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
			expectedToken: unexpiredTokenWithoutRefreshWithIDToken,
		},
		{
			desc:         "should not do token refresh if access token or id token have not expired yet",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
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
			desc:         "should refresh token when the access token is expired",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  expiredToken.AccessToken,
					RefreshToken: expiredToken.RefreshToken,
					ExpiresAt:    expiredToken.Expiry,
					IDToken:      UNEXPIRED_ID_TOKEN,
				}, nil).Twice()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
		{
			desc:         "should refresh token when the id token is expired",
			identity:     userIdentity,
			sessionToken: &auth.UserToken{ExternalSessionId: 1},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.On("GetAuthInfo", mock.Anything, mock.Anything).Return(&login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}, nil)

				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1234,
					AuthModule:   login.GenericOAuthModule,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
					IDToken:      EXPIRED_ID_TOKEN,
				}, nil).Twice()

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(verifyUpdateExternalSessionCommand(unexpiredTokenWithIDToken))).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredTokenWithIDToken)).Once()
			},
			expectedToken: unexpiredTokenWithIDToken,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := socialtest.NewMockSocialConnector(t)
			store := db.InitTestDB(t)
			features := featuremgmt.WithFeatures(featuremgmt.FlagImprovedExternalSessionHandling)

			env := environment{
				sessionService:  authtest.NewMockUserAuthTokenService(t),
				authInfoService: authinfotest.NewMockAuthInfoService(t),
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
				features,
			)

			actualToken := env.service.GetCurrentOAuthToken(context.Background(), tt.identity, tt.sessionToken)

			if tt.expectedToken == nil {
				assert.Nil(t, actualToken)
				return
			}

			assert.NotNil(t, actualToken)
			assert.Equal(t, tt.expectedToken.AccessToken, actualToken.AccessToken)
			assert.Equal(t, tt.expectedToken.RefreshToken, actualToken.RefreshToken)
			assert.WithinDuration(t, tt.expectedToken.Expiry, actualToken.Expiry, time.Second)
			if tt.expectedToken.Extra("id_token") != nil {
				assert.Equal(t, tt.expectedToken.Extra("id_token"), actualToken.Extra("id_token"))
			} else {
				assert.Nil(t, actualToken.Extra("id_token"))
			}
		})
	}
}
