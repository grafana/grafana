package authproxy

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/macaron.v1"
)

type fakeMultiLDAP struct {
	multildap.MultiLDAP
	ID          int64
	userCalled  bool
	loginCalled bool
}

func (m *fakeMultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	m.loginCalled = true
	result := &models.ExternalUserInfo{
		UserId: m.ID,
	}
	return result, nil
}

func (m *fakeMultiLDAP) User(login string) (
	*models.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	m.userCalled = true
	result := &models.ExternalUserInfo{
		UserId: m.ID,
	}
	return result, ldap.ServerConfig{}, nil
}

const hdrName = "markelog"

func prepareMiddleware(t *testing.T, remoteCache *remotecache.RemoteCache, cb func(*http.Request, *setting.Cfg)) *AuthProxy {
	t.Helper()

	cfg := setting.NewCfg()
	cfg.AuthProxyHeaderName = "X-Killa"

	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)
	req.Header.Set(cfg.AuthProxyHeaderName, hdrName)

	if cb != nil {
		cb(req, cfg)
	}

	ctx := &models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{
				Request: req,
			},
		},
	}

	auth := New(cfg, &Options{
		RemoteCache: remoteCache,
		Ctx:         ctx,
		OrgID:       4,
	})

	return auth
}

func TestMiddlewareContext(t *testing.T) {
	logger := log.New("test")
	cache := remotecache.NewFakeStore(t)

	t.Run("When the cache only contains the main header with a simple cache key", func(t *testing.T) {
		const id int64 = 33
		// Set cache key
		h, err := HashCacheKey(hdrName)
		require.NoError(t, err)
		key := fmt.Sprintf(CachePrefix, h)
		err = cache.Set(key, id, 0)
		require.NoError(t, err)
		// Set up the middleware
		auth := prepareMiddleware(t, cache, nil)
		gotKey, err := auth.getKey()
		require.NoError(t, err)
		assert.Equal(t, key, gotKey)

		gotID, err := auth.Login(logger, false)
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
		err = cache.Set(key, id, 0)
		require.NoError(t, err)

		auth := prepareMiddleware(t, cache, func(req *http.Request, cfg *setting.Cfg) {
			req.Header.Set("X-WEBAUTH-GROUPS", group)
			req.Header.Set("X-WEBAUTH-ROLE", role)
			cfg.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS", "Role": "X-WEBAUTH-ROLE"}
		})
		assert.Equal(t, "auth-proxy-sync-ttl:f5acfffd56daac98d502ef8c8b8c5d56", key)

		gotID, err := auth.Login(logger, false)
		require.NoError(t, err)
		assert.Equal(t, id, gotID)
	})
}

func TestMiddlewareContext_ldap(t *testing.T) {
	logger := log.New("test")

	t.Run("Logs in via LDAP", func(t *testing.T) {
		const id int64 = 42

		bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
			cmd.Result = &models.User{
				Id: id,
			}

			return nil
		})

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

		stub := &fakeMultiLDAP{
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

		auth := prepareMiddleware(t, cache, nil)

		gotID, err := auth.Login(logger, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
		assert.True(t, stub.userCalled)
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

		auth := prepareMiddleware(t, cache, nil)

		stub := &fakeMultiLDAP{
			ID: id,
		}

		newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
			return stub
		}

		gotID, err := auth.Login(logger, false)
		require.EqualError(t, err, "failed to get the user")

		assert.NotEqual(t, id, gotID)
		assert.False(t, stub.loginCalled)
	})
}
