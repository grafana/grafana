package clients

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/oauth2"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/configprovider"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSession_Test(t *testing.T) {
	cookieName := "grafana_session"

	validHTTPReq := &http.Request{
		Header: map[string][]string{},
	}
	validHTTPReq.AddCookie(&http.Cookie{Name: cookieName, Value: "bob-the-high-entropy-token"})
	cfg := setting.NewCfg()
	cfg.LoginCookieName = ""
	cfg.LoginMaxLifetime = 20 * time.Second
	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)
	s := ProvideSession(cfgProvider, &authtest.FakeUserAuthTokenService{}, &authinfotest.FakeService{}, tracing.InitializeTracerForTest())

	disabled := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.False(t, disabled)

	cfg.LoginCookieName = cookieName

	good := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.True(t, good)

	invalidHTTPReq := &http.Request{Header: map[string][]string{}}

	bad := s.Test(context.Background(), &authn.Request{HTTPRequest: invalidHTTPReq})
	assert.False(t, bad)
}

func TestSession_Authenticate(t *testing.T) {
	cookieName := "grafana_session"

	validHTTPReq := &http.Request{
		Header: map[string][]string{},
	}
	validHTTPReq.AddCookie(&http.Cookie{Name: cookieName, Value: "bob-the-high-entropy-token"})

	validToken := &usertoken.UserToken{
		Id:            1,
		UserId:        1,
		AuthToken:     "hashyToken",
		PrevAuthToken: "prevHashyToken",
		AuthTokenSeen: true,
		RotatedAt:     time.Now().Unix(),
	}

	type fields struct {
		authInfoService login.AuthInfoService
		sessionService  auth.UserTokenService
	}
	type args struct {
		r *authn.Request
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantID  *authn.Identity
		wantErr bool
	}{
		{
			name: "cookie not found",
			fields: fields{
				sessionService:  &authtest.FakeUserAuthTokenService{},
				authInfoService: &authinfotest.FakeService{},
			},
			args:    args{r: &authn.Request{HTTPRequest: &http.Request{}}},
			wantID:  nil,
			wantErr: true,
		},
		{
			name: "success",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{}},
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				SessionToken: validToken,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
		{
			name: "should return error for token that needs rotation",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return &auth.UserToken{
						AuthTokenSeen: true,
						RotatedAt:     time.Now().Add(-11 * time.Minute).Unix(),
					}, nil
				}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{}},
			},
			args:    args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantErr: true,
		},
		{
			name: "should return identity for token that don't need rotation",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{}},
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:   "1",
				Type: claims.TypeUser,

				SessionToken: validToken,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
		{
			name: "should set authID and authenticated by for externally authenticated user",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				authInfoService: &authinfotest.FakeService{ExpectedUserAuth: &login.UserAuth{AuthId: "1", AuthModule: "oauth_azuread"}},
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				AuthID:          "1",
				AuthenticatedBy: "oauth_azuread",
				SessionToken:    validToken,

				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
		{
			name: "should not set authID and authenticated by when no auth info exists for user",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				authInfoService: &authinfotest.FakeService{ExpectedError: user.ErrUserNotFound},
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "1",
				Type:         claims.TypeUser,
				SessionToken: validToken,

				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.LoginCookieName = cookieName
			cfg.TokenRotationIntervalMinutes = 10
			cfg.LoginMaxLifetime = 20 * time.Second
			cfgProvider, err := configprovider.ProvideService(cfg)
			require.NoError(t, err)
			s := ProvideSession(cfgProvider, tt.fields.sessionService, tt.fields.authInfoService, tracing.InitializeTracerForTest())

			got, err := s.Authenticate(context.Background(), tt.args.r)
			require.True(t, (err != nil) == tt.wantErr, err)
			if err != nil {
				return
			}

			require.EqualValues(t, tt.wantID, got)
		})
	}
}

func TestSession_AuthenticateIncludesOAuthTokens(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.LoginCookieName = "grafana_session"
	cfg.TokenRotationIntervalMinutes = 10
	cfgProvider, err := configprovider.ProvideService(cfg)
	require.NoError(t, err)

	sessionToken := &auth.UserToken{
		Id:            1,
		UserId:        7,
		AuthTokenSeen: true,
		RotatedAt:     time.Now().Unix(),
	}
	oauthToken := &oauth2.Token{AccessToken: "access-token", Expiry: time.Now().Add(time.Hour)}
	for _, tt := range []struct {
		name               string
		includeOAuthTokens bool
		hasAuthInfo        bool
		fallbackAuthModule string
		fallbackError      error
	}{
		{name: "including OAuth tokens reuses linked auth info", includeOAuthTokens: true, hasAuthInfo: true},
		{name: "external session without auth info uses fallback", includeOAuthTokens: true, fallbackAuthModule: login.AzureADAuthModule},
		{name: "missing linked auth info with another OAuth provider discards prefetched credentials", includeOAuthTokens: true, fallbackAuthModule: login.GenericOAuthModule},
		{name: "missing linked auth info with a non-OAuth provider discards prefetched credentials", includeOAuthTokens: true, fallbackAuthModule: login.LDAPAuthModule},
		{name: "missing linked auth info with no fallback discards prefetched credentials", includeOAuthTokens: true, fallbackError: user.ErrUserNotFound},
		{name: "ordinary session uses token-only lookup", fallbackAuthModule: login.AzureADAuthModule},
	} {
		t.Run(tt.name, func(t *testing.T) {
			lookupCalls, oauthLookupCalls := 0, 0
			sessionService := &authtest.FakeUserAuthTokenService{
				LookupTokenProvider: func(context.Context, string) (*auth.UserToken, error) {
					lookupCalls++
					return sessionToken, nil
				},
				LookupTokenForOAuthProvider: func(context.Context, string) (*auth.SessionTokenOAuthInfo, error) {
					oauthLookupCalls++
					return &auth.SessionTokenOAuthInfo{
						Token:       sessionToken,
						AuthModule:  login.AzureADAuthModule,
						OAuthToken:  oauthToken,
						HasAuthInfo: tt.hasAuthInfo,
					}, nil
				},
			}
			authInfo := &authinfotest.FakeService{
				ExpectedUserAuth: &login.UserAuth{AuthId: "fallback-subject", AuthModule: tt.fallbackAuthModule},
				ExpectedError:    tt.fallbackError,
			}
			client := ProvideSession(cfgProvider, sessionService, authInfo, tracing.InitializeTracerForTest())

			httpReq := &http.Request{Header: make(http.Header)}
			httpReq.AddCookie(&http.Cookie{Name: cfg.LoginCookieName, Value: "raw-token"})
			req := &authn.Request{HTTPRequest: httpReq, IncludeOAuthTokens: tt.includeOAuthTokens}

			ident, err := client.Authenticate(context.Background(), req)
			require.NoError(t, err)
			require.NotNil(t, ident)
			assert.Same(t, sessionToken, ident.SessionToken)
			if tt.includeOAuthTokens {
				assert.Zero(t, lookupCalls)
				assert.Equal(t, 1, oauthLookupCalls)
			} else {
				assert.Equal(t, 1, lookupCalls)
				assert.Zero(t, oauthLookupCalls)
			}
			if tt.hasAuthInfo {
				assert.Same(t, oauthToken, ident.OAuthToken)
				assert.Equal(t, login.AzureADAuthModule, ident.AuthenticatedBy)
				assert.Zero(t, authInfo.LatestUserID, "a present auth-info row may have an empty auth ID")
				assert.Empty(t, ident.AuthID)
			} else {
				assert.Nil(t, ident.OAuthToken, "prefetched credentials require their linked auth-info row")
				assert.Equal(t, sessionToken.UserId, authInfo.LatestUserID)
				if tt.fallbackError != nil {
					assert.Empty(t, ident.AuthID)
					assert.Empty(t, ident.AuthenticatedBy)
				} else {
					assert.Equal(t, "fallback-subject", ident.AuthID)
					assert.Equal(t, tt.fallbackAuthModule, ident.AuthenticatedBy)
				}
			}
		})
	}
}
