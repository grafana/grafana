package clients

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/web"
)

func TestGrafana_AuthenticateProxy(t *testing.T) {
	type testCase struct {
		desc             string
		req              *authn.Request
		username         string
		proxyProperty    string
		additional       map[string]string
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:          "expect valid identity",
			username:      "test",
			req:           &authn.Request{HTTPRequest: &http.Request{}},
			proxyProperty: "username",
			additional: map[string]string{
				proxyFieldName:   "name",
				proxyFieldRole:   "Viewer",
				proxyFieldGroups: "grp1,grp2",
				proxyFieldEmail:  "email@email.com",
			},
			expectedIdentity: &authn.Identity{
				OrgRoles:        map[int64]org.RoleType{1: org.RoleViewer},
				Login:           "test",
				Name:            "name",
				Email:           "email@email.com",
				AuthenticatedBy: login.AuthProxyAuthModule,
				AuthID:          "test",
				Groups:          []string{"grp1", "grp2"},
				ClientParams: authn.ClientParams{
					SyncUser:        true,
					SyncTeams:       true,
					AllowSignUp:     true,
					FetchSyncedUser: true,
					SyncOrgRoles:    true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("email@email.com"),
						Login: strPtr("test"),
					},
				},
			},
		},
		{
			desc:       "should set email as both email and login when configured proxy auth header property is email",
			username:   "test@test.com",
			req:        &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			additional: map[string]string{},
			expectedIdentity: &authn.Identity{
				Login:           "test@test.com",
				Email:           "test@test.com",
				AuthenticatedBy: login.AuthProxyAuthModule,
				AuthID:          "test@test.com",
				ClientParams: authn.ClientParams{
					SyncUser:     true,
					SyncTeams:    true,
					AllowSignUp:  true,
					SyncOrgRoles: true,
					LookUpParams: login.UserLookupParams{
						Email: strPtr("test@test.com"),
						Login: strPtr("test@test.com"),
					},
				},
			},
			proxyProperty: "email",
		},
		{
			desc:          "should return error on invalid auth proxy header property",
			req:           &authn.Request{HTTPRequest: &http.Request{Header: map[string][]string{}}},
			proxyProperty: "other",
			expectedErr:   errInvalidProxyHeader,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.AuthProxy.AutoSignUp = true
			cfg.AuthProxy.HeaderProperty = tt.proxyProperty
			c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

			identity, err := c.AuthenticateProxy(context.Background(), tt.req, tt.username, tt.additional)
			assert.ErrorIs(t, err, tt.expectedErr)
			if tt.expectedIdentity != nil {
				assert.Equal(t, tt.expectedIdentity.OrgID, identity.OrgID)
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

func TestGrafana_AuthenticatePassword(t *testing.T) {
	type testCase struct {
		desc             string
		username         string
		password         string
		findUser         bool
		expectedErr      error
		expectedIdentity *authn.Identity
	}

	tests := []testCase{
		{
			desc:     "should successfully authenticate user with correct password",
			username: "user",
			password: "password",
			findUser: true,
			expectedIdentity: &authn.Identity{
				ID:              "1",
				Type:            claims.TypeUser,
				OrgID:           1,
				AuthenticatedBy: login.PasswordAuthModule,
				ClientParams:    authn.ClientParams{FetchSyncedUser: true, SyncPermissions: true},
			},
		},
		{
			desc:        "should fail for incorrect password",
			username:    "user",
			password:    "wrong",
			findUser:    true,
			expectedErr: errInvalidPassword,
		},
		{
			desc:        "should fail if user is not found",
			username:    "user",
			password:    "password",
			expectedErr: errIdentityNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			hashed, _ := util.EncodePassword("password", "salt")
			userService := &usertest.FakeUserService{
				ExpectedUser: &user.User{ID: 1, Password: user.Password(hashed), Salt: "salt"},
			}

			if !tt.findUser {
				userService.ExpectedUser = nil
				userService.ExpectedError = user.ErrUserNotFound
			}

			c := ProvideGrafana(setting.NewCfg(), userService, tracing.InitializeTracerForTest())
			identity, err := c.AuthenticatePassword(context.Background(), &authn.Request{OrgID: 1}, tt.username, tt.password)
			assert.ErrorIs(t, err, tt.expectedErr)
			assert.EqualValues(t, tt.expectedIdentity, identity)
		})
	}
}

func newTestReqContext(t *testing.T) (*contextmodel.ReqContext, *httptest.ResponseRecorder) {
	t.Helper()
	rec := httptest.NewRecorder()
	return &contextmodel.ReqContext{
		Context: &web.Context{
			Resp: web.NewResponseWriter("GET", rec),
		},
	}, rec
}

func TestGrafana_AuthenticateProxy_SyncTeamsWithCookie(t *testing.T) {
	newCfg := func() *setting.Cfg {
		cfg := setting.NewCfg()
		cfg.AuthProxy.HeaderProperty = "username"
		cfg.AuthProxy.AutoSignUp = true
		return cfg
	}

	additional := map[string]string{
		proxyFieldGroups: "grp1,grp2",
	}

	t.Run("SyncTeams is true when no cookie is present", func(t *testing.T) {
		c := ProvideGrafana(newCfg(), usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())
		req := &authn.Request{HTTPRequest: &http.Request{}}
		identity, err := c.AuthenticateProxy(context.Background(), req, "user", additional)
		require.NoError(t, err)
		assert.True(t, identity.ClientParams.SyncTeams)
	})

	t.Run("SyncTeams is false when a matching cookie is present", func(t *testing.T) {
		cfg := newCfg()
		c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		// Pre-compute the hash for the groups using a throwaway request to get the hash.
		req := &authn.Request{HTTPRequest: &http.Request{}}
		identity, err := c.AuthenticateProxy(context.Background(), req, "user", additional)
		require.NoError(t, err)
		groupsHash := hashGroups(cfg.SecretKey, identity.Groups)

		// Now make a request with the matching cookie.
		httpReq := &http.Request{Header: http.Header{}}
		httpReq.AddCookie(&http.Cookie{Name: proxyGroupsCookie, Value: groupsHash})
		req2 := &authn.Request{HTTPRequest: httpReq}
		identity2, err := c.AuthenticateProxy(context.Background(), req2, "user", additional)
		require.NoError(t, err)
		assert.False(t, identity2.ClientParams.SyncTeams)
	})

	t.Run("SyncTeams is true when cookie has a stale hash", func(t *testing.T) {
		c := ProvideGrafana(newCfg(), usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		httpReq := &http.Request{Header: http.Header{}}
		httpReq.AddCookie(&http.Cookie{Name: proxyGroupsCookie, Value: "stalehash"})
		req := &authn.Request{HTTPRequest: httpReq}
		identity, err := c.AuthenticateProxy(context.Background(), req, "user", additional)
		require.NoError(t, err)
		assert.True(t, identity.ClientParams.SyncTeams)
	})

	t.Run("SyncTeams is true when no groups are provided regardless of cookie", func(t *testing.T) {
		c := ProvideGrafana(newCfg(), usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		httpReq := &http.Request{Header: http.Header{}}
		httpReq.AddCookie(&http.Cookie{Name: proxyGroupsCookie, Value: "anyhash"})
		req := &authn.Request{HTTPRequest: httpReq}
		identity, err := c.AuthenticateProxy(context.Background(), req, "user", map[string]string{})
		require.NoError(t, err)
		// SyncTeams defaults to true (set in the initial ClientParams) and is only
		// overridden when the groups field is present.
		assert.True(t, identity.ClientParams.SyncTeams)
	})

	t.Run("group order does not affect whether team sync is skipped", func(t *testing.T) {
		cfg := newCfg()
		c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		// Authenticate once with groups in one order to get the hash written.
		req1 := &authn.Request{HTTPRequest: &http.Request{}}
		identity1, err := c.AuthenticateProxy(context.Background(), req1, "user", map[string]string{proxyFieldGroups: "grp1,grp2"})
		require.NoError(t, err)
		require.True(t, identity1.ClientParams.SyncTeams)
		groupsHash := hashGroups(cfg.SecretKey, identity1.Groups)

		// Now authenticate with the same groups in a different order and the stored cookie.
		httpReq := &http.Request{Header: http.Header{}}
		httpReq.AddCookie(&http.Cookie{Name: proxyGroupsCookie, Value: groupsHash})
		req2 := &authn.Request{HTTPRequest: httpReq}
		identity2, err := c.AuthenticateProxy(context.Background(), req2, "user", map[string]string{proxyFieldGroups: "grp2,grp1"})
		require.NoError(t, err)
		assert.False(t, identity2.ClientParams.SyncTeams)
	})

	t.Run("writes groups hash cookie to the response when team sync is not skipped", func(t *testing.T) {
		cfg := newCfg()
		cfg.AuthProxy.SyncTTL = 60
		c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		reqCtx, rec := newTestReqContext(t)
		ctx := context.WithValue(context.Background(), ctxkey.Key{}, reqCtx)
		req := &authn.Request{HTTPRequest: &http.Request{}}
		identity, err := c.AuthenticateProxy(ctx, req, "user", additional)
		require.NoError(t, err)
		require.True(t, identity.ClientParams.SyncTeams)

		cookies := rec.Result().Cookies()
		require.Len(t, cookies, 1)
		assert.Equal(t, proxyGroupsCookie, cookies[0].Name)
		assert.Equal(t, hashGroups(cfg.SecretKey, identity.Groups), cookies[0].Value)
		assert.Equal(t, 60*60, cookies[0].MaxAge) // SyncTTL minutes → seconds
	})

	t.Run("does not write a new cookie when groups are unchanged", func(t *testing.T) {
		cfg := newCfg()
		c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		groupsHash := hashGroups(cfg.SecretKey, []string{"grp1", "grp2"})
		httpReq := &http.Request{Header: http.Header{}}
		httpReq.AddCookie(&http.Cookie{Name: proxyGroupsCookie, Value: groupsHash})

		reqCtx, rec := newTestReqContext(t)
		ctx := context.WithValue(context.Background(), ctxkey.Key{}, reqCtx)
		req := &authn.Request{HTTPRequest: httpReq}
		identity, err := c.AuthenticateProxy(ctx, req, "user", additional)
		require.NoError(t, err)
		require.False(t, identity.ClientParams.SyncTeams)

		assert.Empty(t, rec.Result().Cookies())
	})

	t.Run("cookie MaxAge is negative when SyncTTL is 0", func(t *testing.T) {
		cfg := newCfg()
		cfg.AuthProxy.SyncTTL = 0
		c := ProvideGrafana(cfg, usertest.NewUserServiceFake(), tracing.InitializeTracerForTest())

		reqCtx, rec := newTestReqContext(t)
		ctx := context.WithValue(context.Background(), ctxkey.Key{}, reqCtx)
		req := &authn.Request{HTTPRequest: &http.Request{}}
		_, err := c.AuthenticateProxy(ctx, req, "user", additional)
		require.NoError(t, err)

		cookies := rec.Result().Cookies()
		require.Len(t, cookies, 1)
		assert.Less(t, cookies[0].MaxAge, 0)
	})
}
