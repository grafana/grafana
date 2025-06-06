package clients

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

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
	s := ProvideSession(cfg, &authtest.FakeUserAuthTokenService{}, &authinfotest.FakeService{})

	disabled := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.False(t, disabled)

	s.cfg.LoginCookieName = cookieName

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
			s := ProvideSession(cfg, tt.fields.sessionService, tt.fields.authInfoService)

			got, err := s.Authenticate(context.Background(), tt.args.r)
			require.True(t, (err != nil) == tt.wantErr, err)
			if err != nil {
				return
			}

			require.EqualValues(t, tt.wantID, got)
		})
	}
}
