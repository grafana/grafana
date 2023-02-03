package clients

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/authtest"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/web"
)

func TestSession_Test(t *testing.T) {
	cookieName := "grafana_session"

	validHTTPReq := &http.Request{
		Header: map[string][]string{},
	}
	validHTTPReq.AddCookie(&http.Cookie{Name: cookieName, Value: "bob-the-high-entropy-token"})

	s := ProvideSession(&authtest.FakeUserAuthTokenService{}, &usertest.FakeUserService{}, "", 20*time.Second)

	disabled := s.Test(context.Background(), &authn.Request{HTTPRequest: validHTTPReq})
	assert.False(t, disabled)

	s.loginCookieName = cookieName

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

	sampleToken := &usertoken.UserToken{
		Id:            1,
		UserId:        1,
		AuthToken:     "hashyToken",
		PrevAuthToken: "prevHashyToken",
		AuthTokenSeen: true,
	}

	sampleUser := &user.SignedInUser{
		UserID:  1,
		Name:    "sample user",
		Login:   "sample_user",
		Email:   "sample_user@samples.iwz",
		OrgID:   1,
		OrgRole: roletype.RoleEditor,
	}

	type fields struct {
		sessionService auth.UserTokenService
		userService    user.Service
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
			name:    "cookie not found",
			fields:  fields{sessionService: &authtest.FakeUserAuthTokenService{}, userService: &usertest.FakeUserService{}},
			args:    args{r: &authn.Request{HTTPRequest: &http.Request{}}},
			wantID:  nil,
			wantErr: true,
		},
		{
			name: "success",
			fields: fields{sessionService: &authtest.FakeUserAuthTokenService{LookupTokenProvider: func(ctx context.Context, unhashedToken string) (*auth.UserToken, error) {
				return sampleToken, nil
			}}, userService: &usertest.FakeUserService{ExpectedSignedInUser: sampleUser}},
			args: args{r: &authn.Request{HTTPRequest: validHTTPReq}},
			wantID: &authn.Identity{
				SessionToken:   sampleToken,
				ID:             "user:1",
				Name:           "sample user",
				Login:          "sample_user",
				Email:          "sample_user@samples.iwz",
				OrgID:          1,
				OrgRoles:       map[int64]roletype.RoleType{1: roletype.RoleEditor},
				IsGrafanaAdmin: boolPtr(false),
			},
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := ProvideSession(tt.fields.sessionService, tt.fields.userService, cookieName, 20*time.Second)

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

func TestSession_RefreshHook(t *testing.T) {
	s := ProvideSession(&authtest.FakeUserAuthTokenService{
		TryRotateTokenProvider: func(ctx context.Context, token *auth.UserToken, clientIP net.IP, userAgent string) (bool, *auth.UserToken, error) {
			token.UnhashedToken = "new-token"
			return true, token, nil
		},
	}, &usertest.FakeUserService{}, "grafana-session", 20*time.Second)

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

	err := s.RefreshTokenHook(context.Background(), sampleID, resp)
	require.NoError(t, err)

	resp.Resp.WriteHeader(201)
	require.Equal(t, 201, mockResponseWriter.Status)

	assert.Equal(t, "new-token", sampleID.SessionToken.UnhashedToken)
	require.Len(t, mockResponseWriter.HeaderStore, 1)
	assert.Equal(t, "grafana-session=new-token; Path=/; Max-Age=20; HttpOnly",
		mockResponseWriter.HeaderStore.Get("set-cookie"), mockResponseWriter.HeaderStore)
}
