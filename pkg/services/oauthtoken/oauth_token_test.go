package oauthtoken

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/secrets/fakes"
	secretsManager "github.com/grafana/grafana/pkg/services/secrets/manager"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var EXPIRED_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"

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
	return &Service{
		Cfg:                  setting.NewCfg(),
		SocialService:        socialService,
		AuthInfoService:      authInfoService,
		singleFlightGroup:    &singleflight.Group{},
		tokenRefreshDuration: newTokenRefreshDurationMetric(prometheus.NewRegistry()),
		cache:                localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
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
		cache           *localcache.CacheService
		identity        identity.Requester
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		service *Service
	}
	type testCase struct {
		desc        string
		expectedErr error
		setup       func(env *environment)
	}

	tests := []testCase{
		{
			desc: "should skip sync when identity is nil",
		},
		{
			desc: "should skip sync when identity is not a user",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("service-account:1")}
			},
		},
		{
			desc: "should skip token refresh and return nil if namespace and id cannot be converted to user ID",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:invalidIdentifierFormat")}
			},
		},
		{
			desc: "should skip token refresh since the token is still valid",
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

				env.identity = &authn.Identity{
					AuthenticatedBy: login.GenericOAuthModule,
					ID:              authn.MustParseNamespaceID("user:1234"),
				}
			},
		},
		{
			desc: "should skip token refresh if the expiration check has already been cached",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.cache.Set("oauth-refresh-token-1234", true, 1*time.Minute)
			},
		},
		{
			desc: "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedError = errors.New("some error")
			},
		},
		{
			desc: "should skip token refresh if the user doesn't have an oauth entry",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.SAMLAuthModule,
				}
			},
		},
		{
			desc: "should do token refresh if access token or id token have not expired yet",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}
			},
		},
		{
			desc: "should skip token refresh when no oauth provider was found",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_JWT,
				}
			},
		},
		{
			desc: "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_JWT,
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: false,
				}
			},
		},
		{
			desc: "should skip token refresh when there is no refresh token",
			setup: func(env *environment) {
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
				env.authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      EXPIRED_JWT,
					OAuthRefreshToken: "",
				}
				env.socialService.ExpectedAuthInfoProvider = &social.OAuthInfo{
					UseRefreshToken: true,
				}
			},
		},
		{
			desc: "should do token refresh when the token is expired",
			setup: func(env *environment) {
				token := &oauth2.Token{
					AccessToken:  "testaccess",
					RefreshToken: "testrefresh",
					Expiry:       time.Now().Add(-time.Hour),
					TokenType:    "Bearer",
				}
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
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
			desc: "should refresh token when the id token is expired",
			setup: func(env *environment) {
				token := &oauth2.Token{
					AccessToken:  "testaccess",
					RefreshToken: "testrefresh",
					Expiry:       time.Now().Add(time.Hour),
					TokenType:    "Bearer",
				}
				env.identity = &authn.Identity{ID: authn.MustParseNamespaceID("user:1234")}
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
					OAuthIdToken:      EXPIRED_JWT,
				}
				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token)).Once()
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := &socialtest.MockSocialConnector{}

			env := environment{
				authInfoService: &authinfotest.FakeService{},
				cache:           localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
			}

			if tt.setup != nil {
				tt.setup(&env)
			}

			env.service = &Service{
				AuthInfoService:      env.authInfoService,
				Cfg:                  setting.NewCfg(),
				cache:                env.cache,
				singleFlightGroup:    &singleflight.Group{},
				SocialService:        env.socialService,
				tokenRefreshDuration: newTokenRefreshDurationMetric(prometheus.NewRegistry()),
			}

			// token refresh
			err := env.service.TryTokenRefresh(context.Background(), env.identity)

			// test and validations
			assert.ErrorIs(t, err, tt.expectedErr)
			socialConnector.AssertExpectations(t)
		})
	}
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
			expectedTokenDuration:    maxOAuthTokenCacheTTL,
		},
		{
			name: "should not need token refresh with an invalid jwt token that might result in an error when parsing",
			usr: &login.UserAuth{
				OAuthIdToken: "invalid_jwt_format",
			},
			expectedTokenRefreshFlag: false,
			expectedTokenDuration:    maxOAuthTokenCacheTTL,
		},
		{
			name: "should flag token refresh with id token is expired",
			usr: &login.UserAuth{
				OAuthIdToken: EXPIRED_JWT,
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
			token, needsTokenRefresh, tokenDuration := needTokenRefresh(tt.usr)

			assert.NotNil(t, token)
			assert.Equal(t, tt.expectedTokenRefreshFlag, needsTokenRefresh)
			assert.Equal(t, tt.expectedTokenDuration, tokenDuration)
		})
	}
}

func TestOAuthTokenSync_tryGetOrRefreshOAuthToken(t *testing.T) {
	timeNow := time.Now()
	token := &oauth2.Token{
		AccessToken:  "oauth_access_token",
		RefreshToken: "refresh_token_found",
		Expiry:       timeNow,
		TokenType:    "Bearer",
	}
	type environment struct {
		authInfoService *authinfotest.FakeService
		cache           *localcache.CacheService
		socialConnector *socialtest.MockSocialConnector
		socialService   *socialtest.FakeSocialService

		service *Service
	}
	tests := []struct {
		desc          string
		expectedErr   error
		expectedToken *oauth2.Token
		usr           *login.UserAuth
		setup         func(env *environment)
	}{
		{
			desc: "should find and retrieve token from cache",
			usr: &login.UserAuth{
				UserId:           int64(1234),
				OAuthAccessToken: "new_access_token",
				OAuthExpiry:      timeNow,
			},
			setup: func(env *environment) {
				env.cache.Set("token-check-1234", token, 1*time.Minute)
			},
			expectedToken: &oauth2.Token{
				AccessToken: "new_access_token",
				Expiry:      timeNow,
			},
		},
		{
			desc: "should return ErrNotAnOAuthProvider error when the user is not an oauth provider",
			usr: &login.UserAuth{
				UserId:     int64(1234),
				AuthModule: login.SAMLAuthModule,
			},
			expectedErr: ErrNotAnOAuthProvider,
		},
		{
			desc: "should return ErrNoRefreshTokenFound error when the no refresh token was found",
			usr: &login.UserAuth{
				UserId:     int64(1234),
				AuthModule: login.GenericOAuthModule,
			},
			expectedErr: ErrNoRefreshTokenFound,
		},
		{
			desc: "should not refresh token if the token is not expired",
			usr: &login.UserAuth{
				UserId:            int64(1234),
				AuthModule:        login.GenericOAuthModule,
				OAuthAccessToken:  token.AccessToken,
				OAuthRefreshToken: token.RefreshToken,
				OAuthExpiry:       timeNow.Add(time.Hour),
				OAuthTokenType:    "Bearer",
			},
			expectedToken: &oauth2.Token{
				AccessToken:  token.AccessToken,
				RefreshToken: token.RefreshToken,
				Expiry:       timeNow.Add(time.Hour),
				TokenType:    "Bearer",
			},
		},
		{
			desc: "should update saved token if the user auth has new access/refresh tokens",
			usr: &login.UserAuth{
				UserId:            int64(1234),
				AuthModule:        login.GenericOAuthModule,
				OAuthAccessToken:  "new_oauth_access_token",
				OAuthRefreshToken: "new_refresh_token_found",
				OAuthExpiry:       timeNow,
			},
			expectedToken: &oauth2.Token{
				AccessToken:  "oauth_access_token",
				RefreshToken: "refresh_token_found",
				Expiry:       timeNow,
				TokenType:    "Bearer",
			},
			setup: func(env *environment) {
				env.socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token)).Once()
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialConnector := &socialtest.MockSocialConnector{}

			env := environment{
				authInfoService: &authinfotest.FakeService{},
				cache:           localcache.New(maxOAuthTokenCacheTTL, 15*time.Minute),
				socialConnector: socialConnector,
				socialService: &socialtest.FakeSocialService{
					ExpectedConnector: socialConnector,
				},
			}

			if tt.setup != nil {
				tt.setup(&env)
			}

			env.service = &Service{
				AuthInfoService:      env.authInfoService,
				Cfg:                  setting.NewCfg(),
				cache:                env.cache,
				singleFlightGroup:    &singleflight.Group{},
				SocialService:        env.socialService,
				tokenRefreshDuration: newTokenRefreshDurationMetric(prometheus.NewRegistry()),
			}

			token, err := env.service.tryGetOrRefreshOAuthToken(context.Background(), tt.usr)

			if tt.expectedToken != nil {
				assert.Equal(t, tt.expectedToken, token)
			}
			assert.ErrorIs(t, tt.expectedErr, err)
			socialConnector.AssertExpectations(t)
		})
	}
}
