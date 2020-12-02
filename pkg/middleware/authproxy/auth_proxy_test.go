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

func prepareMiddleware(t *testing.T, req *http.Request, store *remotecache.RemoteCache) *AuthProxy {
	t.Helper()

	ctx := &models.ReqContext{
		Context: &macaron.Context{
			Req: macaron.Request{
				Request: req,
			},
		},
	}

	auth := New(&Options{
		Store: store,
		Ctx:   ctx,
		OrgID: 4,
	})

	return auth
}

func TestMiddlewareContext(t *testing.T) {
	logger := log.New("test")
	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)
	setting.AuthProxyHeaderName = "X-Killa"
	store := remotecache.NewFakeStore(t)

	name := "markelog"
	req.Header.Add(setting.AuthProxyHeaderName, name)

	t.Run("When the cache only contains the main header with a simple cache key", func(t *testing.T) {
		const id int64 = 33
		// Set cache key
		key := fmt.Sprintf(CachePrefix, HashCacheKey(name))
		err := store.Set(key, id, 0)
		require.NoError(t, err)

		// Set up the middleware
		auth := prepareMiddleware(t, req, store)
		assert.Equal(t, "auth-proxy-sync-ttl:0a7f3374e9659b10980fd66247b0cf2f", auth.getKey())

		gotID, err := auth.Login(logger, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
	})

	t.Run("When the cache key contains additional headers", func(t *testing.T) {
		const id int64 = 33
		setting.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS"}
		group := "grafana-core-team"
		req.Header.Add("X-WEBAUTH-GROUPS", group)

		key := fmt.Sprintf(CachePrefix, HashCacheKey(name+"-"+group))
		err := store.Set(key, id, 0)
		require.NoError(t, err)

		auth := prepareMiddleware(t, req, store)
		assert.Equal(t, "auth-proxy-sync-ttl:14f69b7023baa0ac98c96b31cec07bc0", auth.getKey())

		gotID, err := auth.Login(logger, false)
		require.NoError(t, err)
		assert.Equal(t, id, gotID)
	})
}

func TestMiddlewareContext_ldap(t *testing.T) {
	logger := log.New("test")
	req, err := http.NewRequest("POST", "http://example.com", nil)
	require.NoError(t, err)
	setting.AuthProxyHeaderName = "X-Killa"

	const headerName = "markelog"
	req.Header.Add(setting.AuthProxyHeaderName, headerName)

	t.Run("Logs in via LDAP", func(t *testing.T) {
		const id int64 = 42

		bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
			cmd.Result = &models.User{
				Id: id,
			}

			return nil
		})

		isLDAPEnabled = func() bool {
			return true
		}

		stub := &fakeMultiLDAP{
			ID: id,
		}

		getLDAPConfig = func() (*ldap.Config, error) {
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

		defer func() {
			newLDAP = multildap.New
			isLDAPEnabled = ldap.IsEnabled
			getLDAPConfig = ldap.GetConfig
		}()

		store := remotecache.NewFakeStore(t)

		auth := prepareMiddleware(t, req, store)

		gotID, err := auth.Login(logger, false)
		require.NoError(t, err)

		assert.Equal(t, id, gotID)
		assert.True(t, stub.userCalled)
	})

	t.Run("Gets nice error if ldap is enabled but not configured", func(t *testing.T) {
		const id int64 = 42
		isLDAPEnabled = func() bool {
			return true
		}

		getLDAPConfig = func() (*ldap.Config, error) {
			return nil, errors.New("something went wrong")
		}

		defer func() {
			newLDAP = multildap.New
			isLDAPEnabled = ldap.IsEnabled
			getLDAPConfig = ldap.GetConfig
		}()

		store := remotecache.NewFakeStore(t)

		auth := prepareMiddleware(t, req, store)

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
