package authproxy

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const hdrName = "markelog"
const id int64 = 42

func prepareMiddleware(t *testing.T, remoteCache *remotecache.RemoteCache, configureReq func(*http.Request, *setting.Cfg)) (*AuthProxy, *contextmodel.ReqContext) {
	t.Helper()

	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)

	cfg := setting.NewCfg()

	if configureReq != nil {
		configureReq(req, cfg)
	} else {
		cfg.AuthProxyHeaderName = "X-Killa"
		req.Header.Set(cfg.AuthProxyHeaderName, hdrName)
	}

	ctx := &contextmodel.ReqContext{
		Context: &web.Context{Req: req},
	}

	loginService := loginservice.LoginServiceMock{
		ExpectedUser: &user.User{
			ID: id,
		},
	}

	return ProvideAuthProxy(cfg, remoteCache, loginService, nil, nil, service.NewLDAPFakeService()), ctx
}

func TestMiddlewareContext(t *testing.T) {
	cache := remotecache.NewFakeStore(t)

	t.Run("When the cache only contains the main header with a simple cache key", func(t *testing.T) {
		const id int64 = 33
		// Set cache key
		h, err := HashCacheKey(hdrName)
		require.NoError(t, err)
		key := fmt.Sprintf(CachePrefix, h)
		userIdPayload := []byte(strconv.FormatInt(id, 10))
		err = cache.Set(context.Background(), key, userIdPayload, 0)
		require.NoError(t, err)
		// Set up the middleware
		auth, reqCtx := prepareMiddleware(t, cache, nil)
		gotKey, err := auth.getKey(reqCtx)
		require.NoError(t, err)
		assert.Equal(t, key, gotKey)

		gotID, err := auth.Login(reqCtx, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
	})

	t.Run("When the cache key contains additional headers", func(t *testing.T) {
		const id int64 = 33
		const group = "grafana-core-team"
		const role = "Admin"

		h, err := HashCacheKey(hdrName + "-" + group + "-" + role)
		require.NoError(t, err)
		key := fmt.Sprintf(CachePrefix, h)
		userIdPayload := []byte(strconv.FormatInt(id, 10))
		err = cache.Set(context.Background(), key, userIdPayload, 0)
		require.NoError(t, err)

		auth, reqCtx := prepareMiddleware(t, cache, func(req *http.Request, cfg *setting.Cfg) {
			cfg.AuthProxyHeaderName = "X-Killa"
			cfg.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS", "Role": "X-WEBAUTH-ROLE"}
			req.Header.Set(cfg.AuthProxyHeaderName, hdrName)
			req.Header.Set("X-WEBAUTH-GROUPS", group)
			req.Header.Set("X-WEBAUTH-ROLE", role)
		})
		assert.Equal(t, "auth-proxy-sync-ttl:f5acfffd56daac98d502ef8c8b8c5d56", key)

		gotID, err := auth.Login(reqCtx, false)
		require.NoError(t, err)
		assert.Equal(t, id, gotID)
	})
}

func TestMiddlewareContext_ldap(t *testing.T) {
	t.Run("Logs in via LDAP", func(t *testing.T) {
		cache := remotecache.NewFakeStore(t)

		auth, reqCtx := prepareMiddleware(t, cache, nil)
		auth.cfg.LDAPEnabled = true
		ldapFake := &service.LDAPFakeService{
			ExpectedUser: &login.ExternalUserInfo{UserId: id},
		}

		auth.ldapService = ldapFake

		gotID, err := auth.Login(reqCtx, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
		assert.True(t, ldapFake.UserCalled)
	})

	t.Run("Gets nice error if LDAP is enabled, but not configured", func(t *testing.T) {
		const id int64 = 42
		cache := remotecache.NewFakeStore(t)

		auth, reqCtx := prepareMiddleware(t, cache, nil)
		auth.cfg.LDAPEnabled = true
		ldapFake := &service.LDAPFakeService{
			ExpectedUser:  nil,
			ExpectedError: service.ErrUnableToCreateLDAPClient,
		}

		auth.ldapService = ldapFake

		gotID, err := auth.Login(reqCtx, false)
		require.EqualError(t, err, "failed to get the user")

		assert.NotEqual(t, id, gotID)
		assert.True(t, ldapFake.UserCalled)
	})
}

func TestDecodeHeader(t *testing.T) {
	cache := remotecache.NewFakeStore(t)
	t.Run("should not decode header if not enabled in settings", func(t *testing.T) {
		auth, reqCtx := prepareMiddleware(t, cache, func(req *http.Request, cfg *setting.Cfg) {
			cfg.AuthProxyHeaderName = "X-WEBAUTH-USER"
			cfg.AuthProxyHeadersEncoded = false
			req.Header.Set(cfg.AuthProxyHeaderName, "M=C3=BCnchen")
		})

		header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
		assert.Equal(t, "M=C3=BCnchen", header)
	})

	t.Run("should decode header if enabled in settings", func(t *testing.T) {
		auth, reqCtx := prepareMiddleware(t, cache, func(req *http.Request, cfg *setting.Cfg) {
			cfg.AuthProxyHeaderName = "X-WEBAUTH-USER"
			cfg.AuthProxyHeadersEncoded = true
			req.Header.Set(cfg.AuthProxyHeaderName, "M=C3=BCnchen")
		})

		header := auth.getDecodedHeader(reqCtx, auth.cfg.AuthProxyHeaderName)
		assert.Equal(t, "München", header)
	})
}
