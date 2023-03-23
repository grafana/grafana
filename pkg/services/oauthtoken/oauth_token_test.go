package oauthtoken

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

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
			user:           &user.SignedInUser{},
			want:           nil,
			wantExist:      false,
			wantErr:        true,
			getAuthInfoErr: errors.New("error"),
		},
		{
			name:           "returns false without an error in case auth entry is not found",
			user:           &user.SignedInUser{},
			want:           nil,
			wantExist:      false,
			wantErr:        false,
			getAuthInfoErr: user.ErrUserNotFound,
		},
		{
			name:            "returns false without an error in case the auth entry is not oauth",
			user:            &user.SignedInUser{},
			want:            nil,
			wantExist:       false,
			wantErr:         false,
			getAuthInfoUser: login.UserAuth{AuthModule: "auth_saml"},
		},
		{
			name:            "returns true when the auth entry is found",
			user:            &user.SignedInUser{},
			want:            &login.UserAuth{AuthModule: "oauth_generic_oauth"},
			wantExist:       true,
			wantErr:         false,
			getAuthInfoUser: login.UserAuth{AuthModule: "oauth_generic_oauth"},
		},
	}
	for _, tc := range testCases {
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
	usr := &login.UserAuth{
		AuthModule:        "oauth_generic_oauth",
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}

	authInfoStore.ExpectedOAuth = usr

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))

	err := srv.TryTokenRefresh(ctx, usr)
	assert.Nil(t, err)
	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)

	authInfoQuery := &login.GetAuthInfoQuery{}
	err = srv.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)

	assert.Nil(t, err)

	// User's token data had not been updated
	resultUsr := authInfoQuery.Result
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
	usr := &login.UserAuth{
		AuthModule:        "oauth_generic_oauth",
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))

	err := srv.TryTokenRefresh(ctx, usr)

	assert.NotNil(t, err)
	assert.ErrorIs(t, err, ErrNoRefreshTokenFound)

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

	usr := &login.UserAuth{
		AuthModule:        "oauth_generic_oauth",
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}

	authInfoStore.ExpectedOAuth = usr

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.ReuseTokenSource(token, oauth2.StaticTokenSource(newToken)), nil)

	err := srv.TryTokenRefresh(ctx, usr)

	assert.Nil(t, err)
	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)

	authInfoQuery := &login.GetAuthInfoQuery{}
	err = srv.AuthInfoService.GetAuthInfo(ctx, authInfoQuery)

	assert.Nil(t, err)

	// newToken should be returned after the .Token() call, therefore the User had to be updated
	assert.Equal(t, authInfoQuery.Result.OAuthAccessToken, newToken.AccessToken)
	assert.Equal(t, authInfoQuery.Result.OAuthExpiry, newToken.Expiry)
	assert.Equal(t, authInfoQuery.Result.OAuthRefreshToken, newToken.RefreshToken)
	assert.Equal(t, authInfoQuery.Result.OAuthTokenType, newToken.TokenType)
}

func TestService_TryTokenRefresh_DifferentAuthModuleForUser(t *testing.T) {
	srv, _, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{}
	usr := &login.UserAuth{
		AuthModule: "auth.saml",
	}

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))

	err := srv.TryTokenRefresh(ctx, usr)

	assert.NotNil(t, err)
	assert.ErrorIs(t, err, ErrNotAnOAuthProvider)

	socialConnector.AssertNotCalled(t, "TokenSource")
}

func setupOAuthTokenService(t *testing.T) (*Service, *FakeAuthInfoStore, *MockSocialConnector) {
	t.Helper()

	socialConnector := &MockSocialConnector{}
	socialService := &FakeSocialService{
		connector: socialConnector,
	}

	authInfoStore := &FakeAuthInfoStore{}
	authInfoService := authinfoservice.ProvideAuthInfoService(nil, authInfoStore, &usagestats.UsageStatsMock{})
	return &Service{
		Cfg:               setting.NewCfg(),
		SocialService:     socialService,
		AuthInfoService:   authInfoService,
		singleFlightGroup: &singleflight.Group{},
	}, authInfoStore, socialConnector
}

type FakeSocialService struct {
	httpClient *http.Client
	connector  *MockSocialConnector
}

func (fss *FakeSocialService) GetOAuthProviders() map[string]bool {
	panic("not implemented")
}

func (fss *FakeSocialService) GetOAuthHttpClient(string) (*http.Client, error) {
	return fss.httpClient, nil
}

func (fss *FakeSocialService) GetConnector(string) (social.SocialConnector, error) {
	return fss.connector, nil
}

func (fss *FakeSocialService) GetOAuthInfoProvider(string) *social.OAuthInfo {
	panic("not implemented")
}

func (fss *FakeSocialService) GetOAuthInfoProviders() map[string]*social.OAuthInfo {
	panic("not implemented")
}

type MockSocialConnector struct {
	mock.Mock
}

func (m *MockSocialConnector) Type() int {
	args := m.Called()
	return args.Int(0)
}

func (m *MockSocialConnector) UserInfo(client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	args := m.Called(client, token)
	return args.Get(0).(*social.BasicUserInfo), args.Error(1)
}

func (m *MockSocialConnector) IsEmailAllowed(email string) bool {
	panic("not implemented")
}

func (m *MockSocialConnector) IsSignupAllowed() bool {
	panic("not implemented")
}

func (m *MockSocialConnector) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	panic("not implemented")
}

func (m *MockSocialConnector) Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error) {
	panic("not implemented")
}

func (m *MockSocialConnector) Client(ctx context.Context, t *oauth2.Token) *http.Client {
	panic("not implemented")
}

func (m *MockSocialConnector) TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource {
	args := m.Called(ctx, t)
	return args.Get(0).(oauth2.TokenSource)
}

func (m *MockSocialConnector) SupportBundleContent(bf *bytes.Buffer) error {
	return nil
}

type FakeAuthInfoStore struct {
	login.Store
	ExpectedError                   error
	ExpectedUser                    *user.User
	ExpectedOAuth                   *login.UserAuth
	ExpectedDuplicateUserEntries    int
	ExpectedHasDuplicateUserEntries int
	ExpectedLoginStats              login.LoginStats
}

func (f *FakeAuthInfoStore) GetExternalUserInfoByLogin(ctx context.Context, query *login.GetExternalUserInfoByLoginQuery) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) GetAuthInfo(ctx context.Context, query *login.GetAuthInfoQuery) error {
	query.Result = f.ExpectedOAuth
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) SetAuthInfo(ctx context.Context, cmd *login.SetAuthInfoCommand) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) UpdateAuthInfoDate(ctx context.Context, authInfo *login.UserAuth) error {
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

func (f *FakeAuthInfoStore) GetUserById(ctx context.Context, id int64) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) GetUserByLogin(ctx context.Context, login string) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) GetUserByEmail(ctx context.Context, email string) (*user.User, error) {
	return f.ExpectedUser, f.ExpectedError
}

func (f *FakeAuthInfoStore) CollectLoginStats(ctx context.Context) (map[string]interface{}, error) {
	var res = make(map[string]interface{})
	res["stats.users.duplicate_user_entries"] = f.ExpectedDuplicateUserEntries
	res["stats.users.has_duplicate_user_entries"] = f.ExpectedHasDuplicateUserEntries
	res["stats.users.duplicate_user_entries_by_login"] = 0
	res["stats.users.has_duplicate_user_entries_by_login"] = 0
	res["stats.users.duplicate_user_entries_by_email"] = 0
	res["stats.users.has_duplicate_user_entries_by_email"] = 0
	res["stats.users.mixed_cased_users"] = f.ExpectedLoginStats.MixedCasedUsers
	return res, f.ExpectedError
}

func (f *FakeAuthInfoStore) RunMetricsCollection(ctx context.Context) error {
	return f.ExpectedError
}

func (f *FakeAuthInfoStore) GetLoginStats(ctx context.Context) (login.LoginStats, error) {
	return f.ExpectedLoginStats, f.ExpectedError
}
