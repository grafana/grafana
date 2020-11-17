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
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

type TestMultiLDAP struct {
	multildap.MultiLDAP
	ID          int64
	userCalled  bool
	loginCalled bool
}

func (stub *TestMultiLDAP) Login(query *models.LoginUserQuery) (
	*models.ExternalUserInfo, error,
) {
	stub.loginCalled = true
	result := &models.ExternalUserInfo{
		UserId: stub.ID,
	}
	return result, nil
}

func (stub *TestMultiLDAP) User(login string) (
	*models.ExternalUserInfo,
	ldap.ServerConfig,
	error,
) {
	stub.userCalled = true
	result := &models.ExternalUserInfo{
		UserId: stub.ID,
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
	Convey("auth_proxy helper", t, func() {
		req, err := http.NewRequest("POST", "http://example.com", nil)
		So(err, ShouldBeNil)
		setting.AuthProxyHeaderName = "X-Killa"
		store := remotecache.NewFakeStore(t)

		name := "markelog"
		req.Header.Add(setting.AuthProxyHeaderName, name)

		Convey("when the cache only contains the main header", func() {
			Convey("with a simple cache key", func() {
				// Set cache key
				key := fmt.Sprintf(CachePrefix, HashCacheKey(name))
				err := store.Set(key, int64(33), 0)
				So(err, ShouldBeNil)

				// Set up the middleware
				auth := prepareMiddleware(t, req, store)
				So(auth.getKey(), ShouldEqual, "auth-proxy-sync-ttl:0a7f3374e9659b10980fd66247b0cf2f")

				id, err := auth.Login(logger, false)
				So(err, ShouldBeNil)

				So(id, ShouldEqual, 33)
			})

			Convey("when the cache key contains additional headers", func() {
				setting.AuthProxyHeaders = map[string]string{"Groups": "X-WEBAUTH-GROUPS"}
				group := "grafana-core-team"
				req.Header.Add("X-WEBAUTH-GROUPS", group)

				key := fmt.Sprintf(CachePrefix, HashCacheKey(name+"-"+group))
				err := store.Set(key, int64(33), 0)
				So(err, ShouldBeNil)

				auth := prepareMiddleware(t, req, store)
				So(auth.getKey(), ShouldEqual, "auth-proxy-sync-ttl:14f69b7023baa0ac98c96b31cec07bc0")

				id, err := auth.Login(logger, false)
				So(err, ShouldBeNil)
				So(id, ShouldEqual, 33)
			})
		})

		Convey("LDAP", func() {
			Convey("logs in via LDAP", func() {
				bus.AddHandler("test", func(cmd *models.UpsertUserCommand) error {
					cmd.Result = &models.User{
						Id: 42,
					}

					return nil
				})

				isLDAPEnabled = func() bool {
					return true
				}

				stub := &TestMultiLDAP{
					ID: 42,
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

				id, err := auth.Login(logger, false)

				So(err, ShouldBeNil)
				So(id, ShouldEqual, 42)
				So(stub.userCalled, ShouldEqual, true)
			})

			Convey("gets nice error if ldap is enabled but not configured", func() {
				isLDAPEnabled = func() bool {
					return true
				}

				getLDAPConfig = func() (*ldap.Config, error) {
					return nil, errors.New("Something went wrong")
				}

				defer func() {
					newLDAP = multildap.New
					isLDAPEnabled = ldap.IsEnabled
					getLDAPConfig = ldap.GetConfig
				}()

				store := remotecache.NewFakeStore(t)

				auth := prepareMiddleware(t, req, store)

				stub := &TestMultiLDAP{
					ID: 42,
				}

				newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
					return stub
				}

				id, err := auth.Login(logger, false)

				So(err, ShouldNotBeNil)
				So(err.Error(), ShouldContainSubstring, "failed to get the user")
				So(id, ShouldNotEqual, 42)
				So(stub.loginCalled, ShouldEqual, false)
			})
		})
	})
}
