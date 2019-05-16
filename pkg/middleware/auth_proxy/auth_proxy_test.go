package authproxy

import (
	"fmt"
	"net/http"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/setting"
)

type TestLDAP struct {
	ldap.Auth
	ID         int64
	syncCalled bool
}

func (stub *TestLDAP) SyncUser(query *models.LoginUserQuery) error {
	stub.syncCalled = true
	query.User = &models.User{
		Id: stub.ID,
	}
	return nil
}

func TestMiddlewareContext(t *testing.T) {
	Convey("auth_proxy helper", t, func() {
		req, _ := http.NewRequest("POST", "http://example.com", nil)
		setting.AuthProxyHeaderName = "X-Killa"
		name := "markelog"

		req.Header.Add(setting.AuthProxyHeaderName, name)

		ctx := &models.ReqContext{
			Context: &macaron.Context{
				Req: macaron.Request{
					Request: req,
				},
			},
		}

		Convey("gets data from the cache", func() {
			store := remotecache.NewFakeStore(t)
			key := fmt.Sprintf(CachePrefix, name)
			store.Set(key, int64(33), 0)

			auth := New(&Options{
				Store: store,
				Ctx:   ctx,
				OrgID: 4,
			})

			id, err := auth.GetUserID()

			So(err, ShouldBeNil)
			So(id, ShouldEqual, 33)
		})

		Convey("LDAP", func() {
			Convey("gets data from the LDAP", func() {
				isLDAPEnabled = func() bool {
					return true
				}

				getLDAPConfig = func() (*ldap.Config, error) {
					config := &ldap.Config{
						Servers: []*ldap.ServerConfig{
							{},
						},
					}
					return config, nil
				}

				defer func() {
					isLDAPEnabled = ldap.IsEnabled
					getLDAPConfig = ldap.GetConfig
				}()

				store := remotecache.NewFakeStore(t)

				auth := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				stub := &TestLDAP{
					ID: 42,
				}

				auth.LDAP = func(server *ldap.ServerConfig) ldap.IAuth {
					return stub
				}

				id, err := auth.GetUserID()

				So(err, ShouldBeNil)
				So(id, ShouldEqual, 42)
				So(stub.syncCalled, ShouldEqual, true)
			})

			Convey("gets nice error if ldap is enabled but not configured", func() {
				isLDAPEnabled = func() bool {
					return true
				}

				getLDAPConfig = func() (*ldap.Config, error) {
					config := &ldap.Config{
						Servers: []*ldap.ServerConfig{},
					}
					return config, nil
				}

				defer func() {
					isLDAPEnabled = ldap.IsEnabled
					getLDAPConfig = ldap.GetConfig
				}()

				store := remotecache.NewFakeStore(t)

				auth := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				stub := &TestLDAP{
					ID: 42,
				}

				auth.LDAP = func(server *ldap.ServerConfig) ldap.IAuth {
					return stub
				}

				id, err := auth.GetUserID()

				So(err, ShouldNotBeNil)
				So(err.Error(), ShouldContainSubstring, "Failed to sync user")
				So(id, ShouldNotEqual, 42)
				So(stub.syncCalled, ShouldEqual, false)
			})

		})
	})
}
