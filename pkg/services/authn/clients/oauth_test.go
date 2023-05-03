package clients

import (
	"context"
	"net/http"
	"net/url"
	"testing"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOAuth_Authenticate(t *testing.T) {
	type testCase struct {
		desc     string
		req      *authn.Request
		oauthCfg *social.OAuthInfo

		addStateCookie   bool
		stateCookieValue string

		addPKCECookie   bool
		pkceCookieValue string

		isEmailAllowed bool
		userInfo       *social.BasicUserInfo

		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:        "should return error when missing state cookie",
			req:         &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			oauthCfg:    &social.OAuthInfo{},
			expectedErr: errOAuthMissingState,
		},
		{
			desc:             "should return error when state cookie is present but don't have a value",
			req:              &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			oauthCfg:         &social.OAuthInfo{},
			addStateCookie:   true,
			stateCookieValue: "",
			expectedErr:      errOAuthMissingState,
		},
		{
			desc: "should return error when state from ipd does not match stored state",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://grafana.com/?state=some-other-state"),
			},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			expectedErr:      errOAuthInvalidState,
		},
		{
			desc: "should return error when pkce is configured but the cookie is not present",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://grafana.com/?state=some-state"),
			},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			expectedErr:      errOAuthMissingPKCE,
		},
		{
			desc: "should return error when email is empty",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://grafana.com/?state=some-state"),
			},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			userInfo:         &social.BasicUserInfo{},
			expectedErr:      errOAuthMissingRequiredEmail,
		},
		{
			desc: "should return error when email is not allowed",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://grafana.com/?state=some-state"),
			},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true},
			addStateCookie:   true,
			stateCookieValue: "some-state",
			addPKCECookie:    true,
			pkceCookieValue:  "some-pkce-value",
			userInfo:         &social.BasicUserInfo{Email: "some@email.com"},
			isEmailAllowed:   false,
			expectedErr:      errOAuthEmailNotAllowed,
		},
		{
			desc: "should return identity for valid request",
			req: &authn.Request{HTTPRequest: &http.Request{
				Header: map[string][]string{},
				URL:    mustParseURL("http://grafana.com/?state=some-state"),
			},
			},
			oauthCfg:         &social.OAuthInfo{UsePKCE: true},
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
				Email:      "some@email.com",
				AuthModule: "oauth_azuread",
				AuthID:     "123",
				Name:       "name",
				Groups:     []string{"grp1", "grp2"},
				OAuthToken: &oauth2.Token{},
				OrgRoles:   map[int64]org.RoleType{1: org.RoleAdmin},
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
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()

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

			c := ProvideOAuth(authn.ClientWithPrefix("azuread"), cfg, tt.oauthCfg, fakeConnector{
				ExpectedUserInfo:        tt.userInfo,
				ExpectedToken:           &oauth2.Token{},
				ExpectedIsSignupAllowed: true,
				ExpectedIsEmailAllowed:  tt.isEmailAllowed,
			}, nil)
			identity, err := c.Authenticate(context.Background(), tt.req)
			assert.ErrorIs(t, err, tt.expectedErr)

			if tt.expectedIdentity != nil {
				assert.Equal(t, tt.expectedIdentity.Login, identity.Login)
				assert.Equal(t, tt.expectedIdentity.Name, identity.Name)
				assert.Equal(t, tt.expectedIdentity.Email, identity.Email)
				assert.Equal(t, tt.expectedIdentity.AuthID, identity.AuthID)
				assert.Equal(t, tt.expectedIdentity.AuthModule, identity.AuthModule)
				assert.Equal(t, tt.expectedIdentity.Groups, identity.Groups)

				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncUser, identity.ClientParams.SyncUser)
				assert.Equal(t, tt.expectedIdentity.ClientParams.AllowSignUp, identity.ClientParams.AllowSignUp)
				assert.Equal(t, tt.expectedIdentity.ClientParams.SyncTeams, identity.ClientParams.SyncTeams)
				assert.Equal(t, tt.expectedIdentity.ClientParams.EnableDisabledUsers, identity.ClientParams.EnableDisabledUsers)

				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Email, identity.ClientParams.LookUpParams.Email)
				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.Login, identity.ClientParams.LookUpParams.Login)
				assert.EqualValues(t, tt.expectedIdentity.ClientParams.LookUpParams.UserID, identity.ClientParams.LookUpParams.UserID)
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
			oauthCfg:          &social.OAuthInfo{},
			authCodeUrlCalled: true,
		},
		{
			desc:              "should generate redirect url with hosted domain option if configured",
			oauthCfg:          &social.OAuthInfo{HostedDomain: "grafana.com"},
			numCallOptions:    1,
			authCodeUrlCalled: true,
		},
		{
			desc:              "should generate redirect url with pkce if configured",
			oauthCfg:          &social.OAuthInfo{UsePKCE: true},
			numCallOptions:    2,
			authCodeUrlCalled: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			var (
				authCodeUrlCalled = false
			)

			c := ProvideOAuth(authn.ClientWithPrefix("azuread"), setting.NewCfg(), tt.oauthCfg, mockConnector{
				AuthCodeURLFunc: func(state string, opts ...oauth2.AuthCodeOption) string {
					authCodeUrlCalled = true
					require.Len(t, opts, tt.numCallOptions)
					return ""
				},
			}, nil)

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

func (f fakeConnector) UserInfo(client *http.Client, token *oauth2.Token) (*social.BasicUserInfo, error) {
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
