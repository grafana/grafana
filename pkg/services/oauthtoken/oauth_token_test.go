package oauthtoken

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/remotecache"
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
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"
)

var EXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"

const UNEXPIRED_ID_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
	"eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6InlvdXItY2xpZW50LWlkIiwiZXhwIjo0ODg1NjA4MDAwLCJpYXQiOjE2ODU2MDgwMDAsIm5hbWUiOiJKb2huIERvZSIsImVtYWlsIjoiam9obkBleGFtcGxlLmNvbSJ9." +
	"c2lnbmF0dXJl"

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestService_HasOAuthEntry(t *testing.T) {
	testCases := []struct {
		name            string
		user            *user.SignedInUser
		want            *login.UserAuth
		wantExist       bool
		wantErr         bool
		err             error
		getAuthInfoErr  error
		getAuthInfoUser login.UserAuth
	}{
		{
			name:      "returns false without an error in case user is nil",
			user:      nil,
			want:      nil,
			wantExist: false,
			wantErr:   false,
		},
		{
			name:           "returns false and an error in case GetAuthInfo returns an error",
			user:           &user.SignedInUser{UserID: 1},
			want:           nil,
			wantExist:      false,
			wantErr:        true,
			getAuthInfoErr: errors.New("error"),
		},
		{
			name:           "returns false without an error in case auth entry is not found",
			user:           &user.SignedInUser{UserID: 1},
			want:           nil,
			wantExist:      false,
			wantErr:        false,
			getAuthInfoErr: user.ErrUserNotFound,
		},
		{
			name:            "returns false without an error in case the auth entry is not oauth",
			user:            &user.SignedInUser{UserID: 1},
			want:            nil,
			wantExist:       false,
			wantErr:         false,
			getAuthInfoUser: login.UserAuth{AuthModule: "auth_saml"},
		},
		{
			name:            "returns true when the auth entry is found",
			user:            &user.SignedInUser{UserID: 1},
			want:            &login.UserAuth{AuthModule: login.GenericOAuthModule},
			wantExist:       true,
			wantErr:         false,
			getAuthInfoUser: login.UserAuth{AuthModule: login.GenericOAuthModule},
		},
	}
	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			srv, authInfoStore, _ := setupOAuthTokenService(t)
			authInfoStore.ExpectedOAuth = &tc.getAuthInfoUser
			authInfoStore.ExpectedError = tc.getAuthInfoErr

			entry, exists, err := srv.HasOAuthEntry(context.Background(), tc.user)

			if tc.wantErr {
				assert.Error(t, err)
			}

			if tc.want != nil {
				assert.True(t, reflect.DeepEqual(tc.want, entry))
			}
			assert.Equal(t, tc.wantExist, exists)
		})
	}
}

func setupOAuthTokenService(t *testing.T) (*Service, *FakeAuthInfoStore, *socialtest.MockSocialConnector) {
	t.Helper()

	socialConnector := &socialtest.MockSocialConnector{}
	socialService := &socialtest.FakeSocialService{
		ExpectedConnector: socialConnector,
		ExpectedAuthInfoProvider: &social.OAuthInfo{
			UseRefreshToken: true,
		},
	}

	authInfoStore := &FakeAuthInfoStore{ExpectedOAuth: &login.UserAuth{}}
	authInfoService := authinfoimpl.ProvideService(authInfoStore, remotecache.NewFakeCacheStorage(), secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore()))

	store := db.InitTestDB(t)

	return &Service{
		Cfg:                  setting.NewCfg(),
		SocialService:        socialService,
		AuthInfoService:      authInfoService,
		serverLock:           serverlock.ProvideService(store, tracing.InitializeTracerForTest()),
		tokenRefreshDuration: newTokenRefreshDurationMetric(prometheus.NewRegistry()),
		tracer:               tracing.InitializeTracerForTest(),
	}, authInfoStore, socialConnector
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

func TestService_TryTokenRefresh(t *testing.T) {
	type environment struct {
		authInfoService *authinfotest.FakeService
		serverLock      *serverlock.ServerLockService
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		service *Service
	}
	type testCase struct {
		desc        string
		identity    authn.Identity
		expectedErr error
		setup       func(env *environment)
	}

	tests := []testCase{
		{
			desc: "should skip sync when identity is nil",
		},
		{
			desc:     "should skip sync when identity is not a user",
			identity: authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
		},
		{
			desc:     "should skip token refresh and return nil if namespace and id cannot be converted to user ID",
			identity: authn.Identity{ID: "invalid", Type: claims.TypeUser},
		},
		{
			desc: "should skip token refresh since the token is still valid",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1234",
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				token := &oauth2.Token{
					AccessToken:  "testaccess",
					RefreshToken: "testrefresh",
					Expiry:       time.Now().Add(time.Hour),
					TokenType:    "Bearer",
				}

				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthAccessToken:  token.AccessToken,
					OAuthRefreshToken: token.RefreshToken,
					OAuthExpiry:       token.Expiry,
					OAuthTokenType:    token.TokenType,
				}
			},
		},
		{
			desc:     "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedError = errors.New("some error")
			},
		},
		{
			desc:     "should skip token refresh if the user doesn't have an oauth entry",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.SAMLAuthModule,
				}
			},
		},
		{
			desc:     "should do token refresh if access token or id token have not expired yet",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}
			},
		},
		{
			desc:     "should skip token refresh when no oauth provider was found",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_ID_TOKEN,
				}
			},
		},
		{
			desc:     "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_ID_TOKEN,
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc:     "should skip token refresh when there is no refresh token",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser},
			setup: func(env *environment) {
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
					OAuthRefreshToken: "",
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc:     "should do token refresh when the token is expired",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			setup: func(env *environment) {
				token := &oauth2.Token{
					AccessToken:  "testaccess",
					RefreshToken: "testrefresh",
					Expiry:       time.Now().Add(-time.Hour),
					TokenType:    "Bearer",
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  token.AccessToken,
					OAuthRefreshToken: token.RefreshToken,
					OAuthExpiry:       token.Expiry,
					OAuthTokenType:    token.TokenType,
				}
				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token)).Once()
			},
		},
		{
			desc:     "should refresh token when the id token is expired",
			identity: authn.Identity{ID: "1234", Type: claims.TypeUser, AuthenticatedBy: login.GenericOAuthModule},
			setup: func(env *environment) {
				token := &oauth2.Token{
					AccessToken:  "testaccess",
					RefreshToken: "testrefresh",
					Expiry:       time.Now().Add(time.Hour),
					TokenType:    "Bearer",
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					AuthId:            "subject",
					UserId:            1,
					OAuthAccessToken:  token.AccessToken,
					OAuthRefreshToken: token.RefreshToken,
					OAuthExpiry:       token.Expiry,
					OAuthTokenType:    token.TokenType,
					OAuthIdToken:      EXPIRED_ID_TOKEN,
				}
				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token)).Once()
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := &socialtest.MockSocialConnector{}

			store := db.InitTestDB(t)

			env := environment{
				authInfoService: &authinfotest.FakeService{},
				serverLock:      serverlock.ProvideService(store, tracing.InitializeTracerForTest()),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
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
				nil,
				featuremgmt.WithFeatures(),
			)

			// token refresh
			_, err := env.service.TryTokenRefresh(context.Background(), &tt.identity)

			// test and validations
			assert.ErrorIs(t, err, tt.expectedErr)
			socialConnector.AssertExpectations(t)
		})
	}
}

func TestService_TryTokenRefresh_WithExternalSessions(t *testing.T) {
	unexpiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(time.Hour),
		TokenType:    "Bearer",
	}
	unexpiredToken = unexpiredToken.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	expiredToken := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}

	refreshedToken := &oauth2.Token{
		AccessToken:  "refreshedAccess",
		RefreshToken: "refreshedRefresh",
		Expiry:       time.Now().Add(time.Hour),
	}
	refreshedToken = refreshedToken.WithExtra(map[string]interface{}{
		"id_token": UNEXPIRED_ID_TOKEN,
	})

	type environment struct {
		sessionService  *authtest.MockUserAuthTokenService
		serverLock      *serverlock.ServerLockService
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		service *Service
	}
	type testCase struct {
		desc          string
		identity      authn.Identity
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
			identity: authn.Identity{ID: "1", Type: claims.TypeServiceAccount},
		},
		{
			desc:     "should skip token refresh and return nil if namespace and id cannot be converted to user ID",
			identity: authn.Identity{ID: "invalid", Type: claims.TypeUser},
		},
		{
			desc: "should skip token refresh since the token is still valid",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					IDToken:      unexpiredToken.Extra("id_token").(string),
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc: "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, assert.AnError).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		// Kinda impossible to happen, can only happen after the feature is enabled and logged in users don't have their external sessions set
		{
			desc: "should skip token refresh if the user doesn't have an external session",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(nil, auth.ErrExternalSessionNotFound).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc: "should not do token refresh if access token or id token have not expired yet",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredToken.AccessToken,
					RefreshToken: unexpiredToken.RefreshToken,
					IDToken:      UNEXPIRED_ID_TOKEN,
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc: "should skip token refresh when no oauth provider was found",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = nil
			},
		},
		{
			desc: "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc: "should skip token refresh when there is no refresh token",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:          1,
					UserID:      1,
					AccessToken: unexpiredToken.AccessToken,
					ExpiresAt:   unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: &oauth2.Token{
				AccessToken:  unexpiredToken.AccessToken,
				RefreshToken: "",
				Expiry:       unexpiredToken.Expiry,
			},
		},
		{
			desc: "should refresh token when the access token is expired",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
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

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(func(cmd *auth.UpdateExternalSessionCommand) bool {
					return cmd.Token.AccessToken == unexpiredToken.AccessToken &&
						cmd.Token.RefreshToken == unexpiredToken.RefreshToken &&
						cmd.Token.Expiry == unexpiredToken.Expiry
				})).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(unexpiredToken)).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
			expectedToken: unexpiredToken,
		},
		{
			desc: "should refresh token when the id token is expired",
			identity: authn.Identity{
				AuthenticatedBy: login.GenericOAuthModule,
				ID:              "1",
				SessionToken:    &usertoken.UserToken{ExternalSessionId: 1},
				Type:            claims.TypeUser,
			},
			setup: func(env *environment) {
				env.sessionService.On("GetExternalSession", mock.Anything, int64(1)).Return(&auth.ExternalSession{
					ID:           1,
					UserID:       1,
					AccessToken:  unexpiredToken.AccessToken,
					IDToken:      EXPIRED_ID_TOKEN,
					RefreshToken: unexpiredToken.RefreshToken,
					ExpiresAt:    unexpiredToken.Expiry,
				}, nil).Once()

				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}

				env.sessionService.On("UpdateExternalSession", mock.Anything, int64(1), mock.MatchedBy(func(cmd *auth.UpdateExternalSessionCommand) bool {
					idToken := cmd.Token.Extra("id_token")
					return cmd.Token.AccessToken == refreshedToken.AccessToken &&
						cmd.Token.RefreshToken == refreshedToken.RefreshToken &&
						cmd.Token.Expiry == refreshedToken.Expiry &&
						idToken == refreshedToken.Extra("id_token")
				})).Return(nil).Once()

				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(refreshedToken)).Once()
			},
			expectedToken: refreshedToken,
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := &socialtest.MockSocialConnector{}

			store := db.InitTestDB(t)

			env := environment{
				sessionService: authtest.NewMockUserAuthTokenService(t),
				// authInfoService: &authinfotest.FakeService{},
				serverLock:      serverlock.ProvideService(store, tracing.InitializeTracerForTest()),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
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
			token, err := env.service.TryTokenRefresh(context.Background(), &tt.identity)

			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				return
			}

			assert.NoError(t, err)

			if tt.expectedToken == nil {
				assert.Nil(t, token)
				return
			}

			assert.Equal(t, tt.expectedToken.AccessToken, token.AccessToken)
			assert.Equal(t, tt.expectedToken.RefreshToken, token.RefreshToken)
			assert.Equal(t, tt.expectedToken.Expiry, token.Expiry)
			assert.Equal(t, tt.expectedToken.Extra("id_token"), token.Extra("id_token"))

			socialConnector.AssertExpectations(t)
		})
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
			storedToken := buildOAuthTokenFromAuthInfo(tt.usr)
			needsTokenRefresh := needTokenRefresh(context.Background(), storedToken)

			assert.Equal(t, tt.expectedTokenRefreshFlag, needsTokenRefresh)
		})
	}
}
