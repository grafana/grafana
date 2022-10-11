package oauthtoken

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoservice"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"golang.org/x/oauth2"
	"golang.org/x/sync/singleflight"
)

func TestService_TryTokenRefresh_ValidToken(t *testing.T) {
	srv, _, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now(),
		TokenType:    "Bearer",
	}
	usr := &models.UserAuth{
		AuthModule:        "oauth_generic_oauth",
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(oauth2.StaticTokenSource(token))

	err := srv.TryTokenRefresh(ctx, usr)

	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)
	assert.Nil(t, err)
}

func TestService_TryTokenRefresh_ExpiredToken(t *testing.T) {
	srv, _, socialConnector := setupOAuthTokenService(t)
	ctx := context.Background()
	token := &oauth2.Token{
		AccessToken:  "testaccess",
		RefreshToken: "testrefresh",
		Expiry:       time.Now().Add(-time.Hour),
		TokenType:    "Bearer",
	}
	usr := &models.UserAuth{
		AuthModule:        "oauth_generic_oauth",
		OAuthAccessToken:  token.AccessToken,
		OAuthRefreshToken: token.RefreshToken,
		OAuthExpiry:       token.Expiry,
		OAuthTokenType:    token.TokenType,
	}

	socialConnector.On("TokenSource", mock.Anything, mock.Anything).Return(&fakeTokenSource{token, &oauth2.Token{
		AccessToken:  "newAccessToken",
		RefreshToken: "newRefreshToken",
		Expiry:       time.Now().Add(8 * time.Hour),
		TokenType:    "Bearer",
	}, nil})

	err := srv.TryTokenRefresh(ctx, usr)

	assert.Nil(t, err)
	socialConnector.AssertNumberOfCalls(t, "TokenSource", 1)
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
	usr := &models.UserAuth{
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

func setupOAuthTokenService(t *testing.T) (*Service, login.AuthInfoService, *MockSocialConnector) {
	t.Helper()

	socialConnector := &MockSocialConnector{}
	socialService := &FakeSocialService{
		connector: socialConnector,
	}

	authInfoStore := &FakeAuthInfoStore{}
	authInfoService := authinfoservice.ProvideAuthInfoService(nil, authInfoStore, &usagestats.UsageStatsMock{})
	return &Service{
		SocialService:     socialService,
		AuthInfoService:   authInfoService,
		singleFlightGroup: &singleflight.Group{},
	}, authInfoService, socialConnector
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

type FakeAuthInfoStore struct {
	ExpectedError                   error
	ExpectedUser                    *user.User
	ExpectedOAuth                   *models.UserAuth
	ExpectedDuplicateUserEntries    int
	ExpectedHasDuplicateUserEntries int
	ExpectedLoginStats              login.LoginStats
}

func newFakeAuthInfoStore() *FakeAuthInfoStore {
	return &FakeAuthInfoStore{}
}

func (f *FakeAuthInfoStore) GetExternalUserInfoByLogin(ctx context.Context, query *models.GetExternalUserInfoByLoginQuery) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) GetAuthInfo(ctx context.Context, query *models.GetAuthInfoQuery) error {
	query.Result = f.ExpectedOAuth
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) SetAuthInfo(ctx context.Context, cmd *models.SetAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfoDate(ctx context.Context, authInfo *models.UserAuth) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) UpdateAuthInfo(ctx context.Context, cmd *models.UpdateAuthInfoCommand) error {
	return f.ExpectedError
}
func (f *FakeAuthInfoStore) DeleteAuthInfo(ctx context.Context, cmd *models.DeleteAuthInfoCommand) error {
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

type fakeTokenSource struct {
	t           *oauth2.Token
	newToken    *oauth2.Token
	expectedErr error
}

func (s *fakeTokenSource) Token() (*oauth2.Token, error) {
	if s.expectedErr != nil {
		return nil, s.expectedErr
	}

	if s.t.Valid() {
		return s.t, nil
	}
	return s.newToken, nil
}
