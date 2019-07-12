package authproxy

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/multildap"
	"github.com/grafana/grafana/pkg/setting"
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
	error,
) {
	stub.userCalled = true
	result := &models.ExternalUserInfo{
		UserId: stub.ID,
	}
	return result, nil
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

		Convey("logs in user from the cache", func() {
			store := remotecache.NewFakeStore(t)
			key := fmt.Sprintf(CachePrefix, name)
			store.Set(key, int64(33), 0)

			auth := New(&Options{
				Store: store,
				Ctx:   ctx,
				OrgID: 4,
			})

			id, err := auth.Login()

			So(err, ShouldBeNil)
			So(id, ShouldEqual, 33)
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

				server := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				id, err := server.Login()

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

				auth := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				stub := &TestMultiLDAP{
					ID: 42,
				}

				newLDAP = func(servers []*ldap.ServerConfig) multildap.IMultiLDAP {
					return stub
				}

				id, err := auth.Login()

				So(err, ShouldNotBeNil)
				So(err.Error(), ShouldContainSubstring, "Failed to get the user")
				So(id, ShouldNotEqual, 42)
				So(stub.loginCalled, ShouldEqual, false)
			})

		})
	})
}
