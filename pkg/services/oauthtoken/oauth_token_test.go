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
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

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

func TestService_TryTokenRefresh_ValidToken(t *testing.T) {
	srv, authInfoStore, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now(),
		TokenType:    "Bearer",
	}
	oauth_user := &login.UserAuth{
		AuthModule:        login.GenericOAuthModule,
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}
	oauth_user_identity := &authn.Identity{
		ID:              "user:1234",
		AuthenticatedBy: login.GenericOAuthModule,
	}

	authInfoStore.ExpectedOAuth = oauth_user

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))
	socialConnector.On("GetOAuthInfo").Return(&social.OAuthInfo{UseRefreshToken: true})

	err := srv.TryTokenRefresh(ctx, oauth_user_identity)

	require.Nil(t, err)
	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)

	authInfoQuery := &login.GetAuthInfoQuery{UserId: 1}
	resultUsr, err := srv.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)
	require.Nil(t, err)

	// User's token data had not been updated
	assert.Equal(t, resultUsr.OAuthAccessToken, token.AccessToken)
	assert.Equal(t, resultUsr.OAuthExpiry, token.Expiry)
	assert.Equal(t, resultUsr.OAuthRefreshToken, token.RefreshToken)
	assert.Equal(t, resultUsr.OAuthTokenType, token.TokenType)
}

func TestService_TryTokenRefresh_NoRefreshToken(t *testing.T) {
	srv, _, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}
	usr := &user.SignedInUser{
		AuthenticatedBy: login.GenericOAuthModule,
		UserID:          1,
	}

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))
	socialConnector.On("GetOAuthInfo").Return(&social.OAuthInfo{UseRefreshToken: true})

	err := srv.TryTokenRefresh(ctx, usr)

	assert.Nil(t, err)

	socialConnector.AssertNotCalled(t, "TokenSource")
}

func TestService_TryTokenRefresh_ExpiredToken(t *testing.T) {
	srv, authInfoStore, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}

	newToken := &oauth2.Token{
		AccessToken:  "testaccess_new",
		RefreshToken: "testrefresh_new",
		Expiry:       time.Now().Add(time.Hour),
		TokenType:    "Bearer",
	}

	userAuth := &login.UserAuth{
		AuthModule:        login.GenericOAuthModule,
		AuthId:            "subject",
		UserId:            1,
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}
	signedInUser := &user.SignedInUser{
		AuthenticatedBy: login.GenericOAuthModule,
		UserID:          1,
	}

	authInfoStore.ExpectedOAuth = userAuth

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.ReuseTokenSource(token, oauth2.StaticTokenSource(newToken)), nil)

	err := srv.TryTokenRefresh(ctx, signedInUser)

	require.Nil(t, err)
	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)

	authInfoQuery := &login.GetAuthInfoQuery{
		UserId:     1,
		AuthModule: login.GenericOAuthModule,
		AuthId:     "subject",
	}
	authInfo, err := srv.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)

	require.Nil(t, err)

	// newToken should be returned after the .Token() call, therefore the User had to be updated
	assert.Equal(t, newToken.AccessToken, authInfo.OAuthAccessToken)
	assert.Equal(t, newToken.Expiry, authInfo.OAuthExpiry)
	assert.Equal(t, newToken.RefreshToken, authInfo.OAuthRefreshToken)
	assert.Equal(t, newToken.TokenType, authInfo.OAuthTokenType)
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
	authInfoService := authinfoimpl.ProvideService(authInfoStore, remotecache.NewFakeCacheStorage(),
		secretsManager.SetupTestService(t, fakes.NewFakeSecretsStore()))
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
	type testCase struct {
		desc      string
		identity  *authn.Identity
		oauthInfo *social.OAuthInfo
		setupEnv  func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService)

		expectedErr error
	}

	tests := []testCase{
		{
			desc:        "should skip sync when identity is nil",
			identity:    nil,
			expectedErr: nil,
		},
		{
			desc:        "should skip sync when identity is not a user",
			identity:    &authn.Identity{ID: "service-account:1"},
			expectedErr: nil,
		},
		{
			desc:        "should return nil if namespace and id cannot be converted to user ID",
			identity:    &authn.Identity{ID: "user:invalidIdentifierFormat"},
			expectedErr: nil,
		},
		{
			desc:     "should skip token refresh if the expiration check has already been cached",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				cache.Set("oauth-refresh-token-1234", true, 1*time.Minute)
			},
			expectedErr: nil,
		},
		{
			desc:     "should skip token refresh if there's an unexpected error while looking up the user oauth entry, additionally, no error should be returned",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedError = errors.New("some error")
			},
			expectedErr: nil,
		},
		{
			desc:     "should skip token refresh if the user doens't has an oauth entry",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.SAMLAuthModule,
				}
			},
			expectedErr: nil,
		},
		{
			desc:     "should refresh the token refresh if acces token or id token have not expired yet",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule: login.GenericOAuthModule,
				}
			},
			expectedErr: nil,
		},
		{
			desc:     "should skip token refresh when no oauth provider was found",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_JWT,
				}
			},
			expectedErr: nil,
			oauthInfo:   nil,
		},
		{
			desc:     "should skip token refresh when oauth provider token handling is disabled (UseRefreshToken is false)",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:   login.GenericOAuthModule,
					OAuthIdToken: EXPIRED_JWT,
				}
			},
			expectedErr: nil,
			oauthInfo: &social.OAuthInfo{
				UseRefreshToken: false,
			},
		},
		{
			desc:     "should skip token refresh when oauth provider token handling is disabled and the refresh token is empty",
			identity: &authn.Identity{ID: "user:1234"},
			setupEnv: func(cache *localcache.CacheService, authInfoService *authinfotest.FakeService) {
				authInfoService.ExpectedUserAuth = &login.UserAuth{
					AuthModule:        login.GenericOAuthModule,
					OAuthIdToken:      EXPIRED_JWT,
					OAuthRefreshToken: "",
				}
			},
			expectedErr: nil,
			oauthInfo: &social.OAuthInfo{
				UseRefreshToken: true,
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			socialService := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthInfo,
			}

			authInfoService := &authinfotest.FakeService{}

			service := &Service{
				AuthInfoService:   authInfoService,
				SocialService:     socialService,
				singleFlightGroup: new(singleflight.Group),
				cache:             localcache.New(0, 0),
			}

			if tt.setupEnv != nil {
				tt.setupEnv(service.cache, authInfoService)
			}

			err := service.TryTokenRefresh(context.Background(), tt.identity)
			assert.ErrorIs(t, err, tt.expectedErr)
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
