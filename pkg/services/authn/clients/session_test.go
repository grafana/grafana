package clients

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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
	s := ProvideSession(cfg, &authtest.FakeUserAuthTokenService{}, featuremgmt.WithFeatures())

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
		sessionService auth.UserTokenService
		features       *featuremgmt.FeatureManager
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
				sessionService: &authtest.FakeUserAuthTokenService{},
				features:       featuremgmt.WithFeatures(),
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
				features: featuremgmt.WithFeatures(),
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "user:1",
				SessionToken: validToken,
				ClientParams: authn.ClientParams{
					SyncPermissions: true,
					FetchSyncedUser: true,
				},
			},
			wantErr: false,
		},
		{
			name: "should return error for token that needs rotation if ClientTokenRotation is enabled",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return &auth.UserToken{
						AuthTokenSeen: true,
						RotatedAt:     time.Now().Add(-11 * time.Minute).Unix(),
					}, nil
				}},
				features: featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation),
			},
			args:    args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantErr: true,
		},
		{
			name: "should return identity for token that don't need rotation if ClientTokenRotation is enabled",
			fields: fields{
				sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
					return validToken, nil
				}},
				features: featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation),
			},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				ID:           "user:1",
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
			s := ProvideSession(cfg, tt.fields.sessionService, tt.fields.features)

			got, err := s.Authenticate(context.Background(), tt.args.r)
			require.True(t, (err != nil) == tt.wantErr, err)
			if err != nil {
				return
			}

			require.EqualValues(t, tt.wantID, got)
		})
	}
}

type fakeResponseWriter struct {
	Status      int
	HeaderStore http.Header
}

func (f *fakeResponseWriter) Header() http.Header {
	return f.HeaderStore
}

func (f *fakeResponseWriter) Write([]byte) (int, error) {
	return 0, nil
}

func (f *fakeResponseWriter) WriteHeader(statusCode int) {
	f.Status = statusCode
}

func TestSession_Hook(t *testing.T) {
	t.Run("should rotate token", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LoginCookieName = "grafana-session"
		cfg.LoginMaxLifetime = 20 * time.Second
		s := ProvideSession(cfg, &authtest.FakeUserAuthTokenService{
			TryRotateTokenProvider: func(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (bool, *auth.UserToken, error) {
				token.UnhashedToken = "new-token"
				return true, token, nil
			},
		}, featuremgmt.WithFeatures())

		sampleID := &authn.Identity{
			SessionToken: &auth.UserToken{
				Id:     1,
				UserId: 1,
			},
		}

		mockResponseWriter := &fakeResponseWriter{
			Status:      0,
			HeaderStore: map[string][]string{},
		}

		resp := &authn.Request{
			HTTPRequest: &http.Request{
				Header: map[string][]string{},
			},
			Resp: web.NewResponseWriter(http.MethodConnect, mockResponseWriter),
		}

		err := s.Hook(context.Background(), sampleID, resp)
		require.NoError(t, err)

		resp.Resp.WriteHeader(201)
		require.Equal(t, 201, mockResponseWriter.Status)

		assert.Equal(t, "new-token", sampleID.SessionToken.UnhashedToken)
		require.Len(t, mockResponseWriter.HeaderStore, 1)
		assert.Equal(t, "grafana-session=new-token; Path=/; Max-Age=20; HttpOnly",
			mockResponseWriter.HeaderStore.Get("set-cookie"), mockResponseWriter.HeaderStore)
	})

	t.Run("should not rotate token with feature flag", func(t *testing.T) {
		s := ProvideSession(setting.NewCfg(), nil, featuremgmt.WithFeatures(featuremgmt.FlagClientTokenRotation))

		req := &authn.Request{}
		identity := &authn.Identity{}
		err := s.Hook(context.Background(), identity, req)
		require.NoError(t, err)
	})
}
