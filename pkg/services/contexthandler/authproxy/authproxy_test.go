package authproxy

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/login/loginservice"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

const hdrName = "markelog"
const id int64 = 42

func prepareMiddleware(t *testing.T, remoteCache *remotecache.RemoteCache, configureReq func(*http.Request, *setting.Cfg)) (*AuthProxy, *models.ReqContext) {
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

	ctx := &models.ReqContext{
		Context: &web.Context{Req: req},
	}

	loginService := loginservice.LoginServiceMock{
		ExpectedUser: &user.User{
			ID: id,
		},
	}

	return ProvideAuthProxy(cfg, remoteCache, loginService, nil, nil), ctx
}

func TestMiddlewareContext(t *testing.T) {
	cache := remotecache.NewFakeStore(t)

	t.Run("When the cache only contains the main header with a simple cache key", func(t *testing.T) {
		const id int64 = 33
		// Set cache key
		h, err := HashCacheKey(hdrName)
		require.NoError(t, err)
		key := fmt.Sprintf(CachePrefix, h)
		err = cache.Set(context.Background(), key, id, 0)
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
		err = cache.Set(context.Background(), key, id, 0)
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
		origIsLDAPEnabled := isLDAPEnabled
		origGetLDAPConfig := getLDAPConfig
		origNewLDAP := newLDAP
		t.Cleanup(func() {
			newLDAP = origNewLDAP
			isLDAPEnabled = origIsLDAPEnabled
			getLDAPConfig = origGetLDAPConfig
		})

		isLDAPEnabled = func(*setting.Cfg) bool {
			return true
		}

		stub := &multildap.MultiLDAPmock{
			ID: id,
		}

		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			config := &ldap.Config{
				Servers: []*ldap.ServerConfig{
					{
						SearchBaseDNs: []string{"BaseDNHere"},
					},
				},
			}
			return config, nil
		}

		newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
			return stub
		}

		cache := remotecache.NewFakeStore(t)

		auth, reqCtx := prepareMiddleware(t, cache, nil)

		gotID, err := auth.Login(reqCtx, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
		assert.True(t, stub.UserCalled)
	})

	t.Run("Gets nice error if LDAP is enabled, but not configured", func(t *testing.T) {
		const id int64 = 42
		origIsLDAPEnabled := isLDAPEnabled
		origNewLDAP := newLDAP
		origGetLDAPConfig := getLDAPConfig
		t.Cleanup(func() {
			isLDAPEnabled = origIsLDAPEnabled
			newLDAP = origNewLDAP
			getLDAPConfig = origGetLDAPConfig
		})

		isLDAPEnabled = func(*setting.Cfg) bool {
			return true
		}

		getLDAPConfig = func(*setting.Cfg) (*ldap.Config, error) {
			return nil, errors.New("something went wrong")
		}

		cache := remotecache.NewFakeStore(t)

		auth, reqCtx := prepareMiddleware(t, cache, nil)

		stub := &multildap.MultiLDAPmock{
			ID: id,
		}

		newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
			return stub
		}

		gotID, err := auth.Login(reqCtx, false)
		require.EqualError(t, err, "failed to get the user")

		assert.NotEqual(t, id, gotID)
		assert.False(t, stub.LoginCalled)
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
