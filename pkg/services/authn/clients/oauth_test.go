package clients

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"golang.org/x/oauth2"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/socialtest"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/oauthtoken/oauthtokentest"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestOAuth_Authenticate(t *testing.T) {
	type testCase struct {
		desc                  string
		req                   *authn.Request
		oauthCfg              *social.OAuthInfo
		allowInsecureTakeover bool

		addStateCookie   bool
		stateCookieValue string

		addPKCECookie   bool
		pkceCookieValue string

		features []any

		isEmailAllowed bool
		userInfo       *social.BasicUserInfo

		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:        "should return error when missing state cookie",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			oauthCfg:    &social.OAuthInfo{Enabled: true},
			expectedErr: errOAuthMissingState,
		},
		{
			desc:             "should return error when state cookie is present but don't have a value",
			req:              &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			oauthCfg:         &social.OAuthInfo{Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "",
			expectedErr:      errOAuthMissingState,
		},
		{
			desc:        "should return error when the client is not enabled",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			oauthCfg:    &social.OAuthInfo{Enabled: false},
			expectedErr: errOAuthClientDisabled,
		},
		{
			desc: "should return error when state from ipd does not match stored state",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-other-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			expectedErr:      errOAuthInvalidState,
		},
		{
			desc: "should return error when pkce is configured but the cookie is not present",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			expectedErr:      errOAuthMissingPKCE,
		},
		{
			desc: "should return error when email is empty",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			userInfo:         &social.BasicUserInfo{},
			expectedErr:      errOAuthMissingRequiredEmail,
		},
		{
			desc: "should return error when email is not allowed",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			userInfo:         &social.BasicUserInfo{Email: "some@email.com"},
			isEmailAllowed:   false,
			expectedErr:      errOAuthEmailNotAllowed,
		},
		{
			desc: "should return error when no auth id is set and feature toggle is enabled",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			features:         []any{featuremgmt.FlagOauthRequireSubClaim},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			userInfo:         &social.BasicUserInfo{Email: "some@email.com"},
			isEmailAllowed:   false,
			expectedErr:      errOAuthUserInfo,
		},
		{
			desc: "should return identity for valid request",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true, Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			isEmailAllowed:   true,
			userInfo: &social.BasicUserInfo{
				Id:     "123",
				Name:   "name",
				Email:  "some@email.com",
				Role:   "Admin",
				Groups: []string{"grp1", "grp2"},
			},
			expectedIdentity: &authn.Identity{
				Email:           "some@email.com",
				AuthenticatedBy: login.AzureADAuthModule,
				AuthID:          "123",
				Name:            "name",
				Groups:          []string{"grp1", "grp2"},
				OAuthToken:      &oauth2.Token{},
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					LookUpParams:    login.UserLookupParams{},
				},
			},
		},
		{
			desc: "should return identity for valid request - and lookup user by email",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:              &social.OAuthInfo{UsePKCE: true, Enabled: true},
			allowInsecureTakeover: true,
			addStateCookie:        true,
			stateCookieValue:      "some-state",
			addPKCECookie:         true,
			pkceCookieValue:       "some-pkce-value",
			isEmailAllowed:        true,
			userInfo: &social.BasicUserInfo{
				Id:     "123",
				Name:   "name",
				Email:  "some@email.com",
				Role:   "Admin",
				Groups: []string{"grp1", "grp2"},
			},
			expectedIdentity: &authn.Identity{
				Email:           "some@email.com",
				AuthenticatedBy: login.AzureADAuthModule,
				AuthID:          "123",
				Name:            "name",
				Groups:          []string{"grp1", "grp2"},
				OAuthToken:      &oauth2.Token{},
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					LookUpParams:    login.UserLookupParams{Email: strPtr("some@email.com")},
				},
			},
		},
		{
			desc: "should return identity when feature toggle is enabled and auth id is set",
			req: &authn.Request{
				HTTPRequest: &http.Request{
					Header: map[string][]string{},
					URL:    mustParseURL("http://grafana.com/?state=some-state"),
				},
			},
			oauthCfg:         &social.OAuthInfo{Enabled: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			isEmailAllowed:   true,
			features:         []any{featuremgmt.FlagOauthRequireSubClaim},
			userInfo: &social.BasicUserInfo{
				Id:    "123",
				Name:  "name",
				Email: "some@email.com",
				Role:  "Admin",
			},
			expectedIdentity: &authn.Identity{
				Email:           "some@email.com",
				AuthenticatedBy: login.AzureADAuthModule,
				AuthID:          "123",
				Name:            "name",
				OAuthToken:      &oauth2.Token{},
				OrgRoles:        map[int64]org.RoleType{1: org.RoleAdmin},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					LookUpParams:    login.UserLookupParams{},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			auth, err := cfg.Raw.NewSection("auth")
			assert.NoError(t, err)
			_, err = auth.NewKey("oauth_allow_insecure_email_lookup", strconv.FormatBool(tt.allowInsecureTakeover))
			assert.NoError(t, err)

			settingsProvider := &setting.OSSImpl{Cfg: cfg}

			if tt.addStateCookie {
				v := tt.stateCookieValue
				if v != "" {
					v = hashOAuthState(v, cfg.SecretKey, tt.oauthCfg.ClientSecret)
				}
				tt.req.HTTPRequest.AddCookie(&http.Cookie{Name: oauthStateCookieName, Value: v})
			}

			if tt.addPKCECookie {
				tt.req.HTTPRequest.AddCookie(&http.Cookie{Name: oauthPKCECookieName, Value: tt.pkceCookieValue})
			}

			fakeSocialSvc := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthCfg,
				ExpectedConnector: fakeConnector{
					ExpectedUserInfo:        tt.userInfo,
					ExpectedToken:           &oauth2.Token{},
					ExpectedIsSignupAllowed: true,
					ExpectedIsEmailAllowed:  tt.isEmailAllowed,
				},
			}

			c := ProvideOAuth(authn.ClientWithPrefix("azuread"), cfg, nil, fakeSocialSvc, settingsProvider, featuremgmt.WithFeatures(tt.features...))

			identity, err := c.Authenticate(context.Background(), tt.req)
			assert.ErrorIs(t, err, tt.expectedErr)

			if tt.expectedIdentity != nil {
				assert.Equal(t, tt.expectedIdentity.Login, identity.Login)
				assert.Equal(t, tt.expectedIdentity.Name, identity.Name)
				assert.Equal(t, tt.expectedIdentity.Email, identity.Email)
				assert.Equal(t, tt.expectedIdentity.AuthID, identity.AuthID)
				assert.Equal(t, tt.expectedIdentity.AuthenticatedBy, identity.AuthenticatedBy)
				assert.Equal(t, tt.expectedIdentity.Groups, identity.Groups)

				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncUser, identity.ClientParams.SyncUser)
				assert.Equal(t, tt.expectedIdentity.ClientParams.AllowSignUp, identity.ClientParams.AllowSignUp)
				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncTeams, identity.ClientParams.SyncTeams)
				assert.Equal(t, tt.expectedIdentity.ClientParams.EnableUser, identity.ClientParams.EnableUser)

				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Email, identity.ClientParams.LookUpParams.Email)
				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Login, identity.ClientParams.LookUpParams.Login)
			} else {
				assert.Nil(t, tt.expectedIdentity)
			}
		})
	}
}

func TestOAuth_RedirectURL(t *testing.T) {
	type testCase struct {
		desc        string
		oauthCfg    *social.OAuthInfo
		expectedErr error

		numCallOptions    int
		authCodeUrlCalled bool
	}

	tests := []testCase{
		{
			desc:              "should generate redirect url and state",
			oauthCfg:          &social.OAuthInfo{Enabled: true},
			authCodeUrlCalled: true,
		},
		{
			desc:              "should generate redirect url with hosted domain option if configured",
			oauthCfg:          &social.OAuthInfo{HostedDomain: "grafana.com", Enabled: true},
			numCallOptions:    1,
			authCodeUrlCalled: true,
		},
		{
			desc:              "should generate redirect url with pkce if configured",
			oauthCfg:          &social.OAuthInfo{UsePKCE: true, Enabled: true},
			numCallOptions:    1,
			authCodeUrlCalled: true,
		},
		{
			desc:              "should return error if the client is not enabled",
			oauthCfg:          &social.OAuthInfo{Enabled: false},
			authCodeUrlCalled: false,
			expectedErr:       errOAuthClientDisabled,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			authCodeUrlCalled := false

			fakeSocialSvc := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthCfg,
				ExpectedConnector: mockConnector{
					AuthCodeURLFunc: func(state string, opts ...oauth2.AuthCodeOption) string {
						authCodeUrlCalled = true
						require.Len(t, opts, tt.numCallOptions)
						return ""
					},
				},
			}

			cfg := setting.NewCfg()

			c := ProvideOAuth(authn.ClientWithPrefix("azuread"), cfg, nil, fakeSocialSvc, &setting.OSSImpl{Cfg: cfg}, featuremgmt.WithFeatures())

			redirect, err := c.RedirectURL(context.Background(), nil)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.Equal(t, tt.authCodeUrlCalled, authCodeUrlCalled)

			if tt.expectedErr != nil {
				return
			}

			assert.NotEmpty(t, redirect.Extra[authn.KeyOAuthState])
			if tt.oauthCfg.UsePKCE {
				assert.NotEmpty(t, redirect.Extra[authn.KeyOAuthPKCE])
			}
		})
	}
}

func TestOAuth_Logout(t *testing.T) {
	type testCase struct {
		desc     string
		cfg      *setting.Cfg
		oauthCfg *social.OAuthInfo

		expectedOK            bool
		expectedURL           string
		expectedIDTokenHint   string
		expectedPostLogoutURI string
	}

	tests := []testCase{
		{
			desc:     "should not return redirect url if not configured for client or globably",
			cfg:      &setting.Cfg{},
			oauthCfg: &social.OAuthInfo{},
		},
		{
			desc:     "should not return redirect url when client is not enabled",
			cfg:      &setting.Cfg{},
			oauthCfg: &social.OAuthInfo{Enabled: false},
		},
		{
			desc: "should return redirect url for globably configured redirect url",
			cfg: &setting.Cfg{
				SignoutRedirectUrl: "http://idp.com/logout",
			},
			oauthCfg:    &social.OAuthInfo{Enabled: true},
			expectedURL: "http://idp.com/logout",
			expectedOK:  true,
		},
		{
			desc: "should return redirect url for client configured redirect url",
			cfg:  &setting.Cfg{},
			oauthCfg: &social.OAuthInfo{
				Enabled:            true,
				SignoutRedirectUrl: "http://idp.com/logout",
			},
			expectedURL: "http://idp.com/logout",
			expectedOK:  true,
		},
		{
			desc: "client specific url should take precedence",
			cfg: &setting.Cfg{
				SignoutRedirectUrl: "http://idp.com/logout",
			},
			oauthCfg: &social.OAuthInfo{
				Enabled:            true,
				SignoutRedirectUrl: "http://idp-2.com/logout",
			},
			expectedURL: "http://idp-2.com/logout",
			expectedOK:  true,
		},
		{
			desc: "should add id token hint if oicd logout is configured and token is valid",
			cfg:  &setting.Cfg{},
			oauthCfg: &social.OAuthInfo{
				Enabled:            true,
				SignoutRedirectUrl: "http://idp.com/logout?post_logout_redirect_uri=http%3A%3A%2F%2Ftest.com%2Flogin",
			},
			expectedURL:           "http://idp.com/logout",
			expectedIDTokenHint:   "id_token_hint=some.id.token",
			expectedPostLogoutURI: "http%3A%3A%2F%2Ftest.com%2Flogin",
			expectedOK:            true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var (
				getTokenCalled        bool
				invalidateTokenCalled bool
			)

			mockService := &oauthtokentest.MockOauthTokenService{
				GetCurrentOauthTokenFunc: func(_ context.Context, _ identity.Requester, _ *auth.UserToken) *oauth2.Token {
					getTokenCalled = true
					token := &oauth2.Token{
						AccessToken: "some.access.token",
						Expiry:      time.Now().Add(10 * time.Minute),
					}
					return token.WithExtra(map[string]any{
						"id_token": "some.id.token",
					})
				},
				InvalidateOAuthTokensFunc: func(_ context.Context, _ identity.Requester, _ *auth.UserToken) error {
					invalidateTokenCalled = true
					return nil
				},
			}

			fakeSocialSvc := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthCfg,
			}
			c := ProvideOAuth(authn.ClientWithPrefix("azuread"), tt.cfg, mockService, fakeSocialSvc, &setting.OSSImpl{Cfg: tt.cfg}, featuremgmt.WithFeatures())

			redirect, ok := c.Logout(context.Background(), &authn.Identity{ID: "1", Type: claims.TypeUser}, nil)

			assert.Equal(t, tt.expectedOK, ok)
			if tt.expectedOK {
				assert.True(t, strings.HasPrefix(redirect.URL, tt.expectedURL))
				assert.Contains(t, redirect.URL, tt.expectedIDTokenHint)
				assert.Contains(t, redirect.URL, tt.expectedPostLogoutURI)
			}

			assert.True(t, getTokenCalled)
			assert.True(t, invalidateTokenCalled)
		})
	}
}

func TestGenPKCECodeVerifier(t *testing.T) {
	verifier, err := genPKCECodeVerifier()
	assert.NoError(t, err)
	assert.Len(t, verifier, 128)
}

func TestIsEnabled(t *testing.T) {
	type testCase struct {
		desc     string
		oauthCfg *social.OAuthInfo
		expected bool
	}

	tests := []testCase{
		{
			desc:     "should return false when client is not enabled",
			oauthCfg: &social.OAuthInfo{Enabled: false},
			expected: false,
		},
		{
			desc:     "should return false when client doesnt exists",
			oauthCfg: nil,
			expected: false,
		},
		{
			desc:     "should return true when client is enabled",
			oauthCfg: &social.OAuthInfo{Enabled: true},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			fakeSocialSvc := &socialtest.FakeSocialService{
				ExpectedAuthInfoProvider: tt.oauthCfg,
			}
			cfg := setting.NewCfg()
			c := ProvideOAuth(
				social.GitHubProviderName,
				cfg,
				nil,
				fakeSocialSvc,
				&setting.OSSImpl{Cfg: cfg},
				featuremgmt.WithFeatures())
			assert.Equal(t, tt.expected, c.IsEnabled())
		})
	}
}

type mockConnector struct {
	AuthCodeURLFunc func(state string, opts ...oauth2.AuthCodeOption) string
	social.SocialConnector
}

func (m mockConnector) AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string {
	if m.AuthCodeURLFunc != nil {
		return m.AuthCodeURLFunc(state, opts...)
	}
	return ""
}

var _ social.SocialConnector = new(fakeConnector)

type fakeConnector struct {
	ExpectedUserInfo        *social.BasicUserInfo
	ExpectedUserInfoErr     error
	ExpectedIsEmailAllowed  bool
	ExpectedIsSignupAllowed bool
	ExpectedToken           *oauth2.Token
	ExpectedTokenErr        error
	social.SocialConnector
}

func (f fakeConnector) UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
	return f.ExpectedUserInfo, f.ExpectedUserInfoErr
}

func (f fakeConnector) IsEmailAllowed(email string) bool {
	return f.ExpectedIsEmailAllowed
}

func (f fakeConnector) IsSignupAllowed() bool {
	return f.ExpectedIsSignupAllowed
}

func (f fakeConnector) Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error) {
	return f.ExpectedToken, f.ExpectedTokenErr
}

func (f fakeConnector) Client(ctx context.Context, t *oauth2.Token) *http.Client {
	return nil
}

func mustParseURL(s string) *url.URL {
	u, err := url.Parse(s)
	if err != nil {
		panic(err)
	}
	return u
}
