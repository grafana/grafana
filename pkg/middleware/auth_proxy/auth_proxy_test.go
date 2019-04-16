package authproxy

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/login"
	models "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

type TestLDAP struct {
	login.ILdapAuther
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
				login.LdapCfg = login.LdapConfig{
					Servers: []*login.LdapServerConf{
						{},
					},
				}

				setting.LdapEnabled = true

				store := remotecache.NewFakeStore(t)

				auth := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				stub := &TestLDAP{
					ID: 42,
				}

				auth.LDAP = func(server *login.LdapServerConf) login.ILdapAuther {
					return stub
				}

				id, err := auth.GetUserID()

				So(err, ShouldBeNil)
				So(id, ShouldEqual, 42)
				So(stub.syncCalled, ShouldEqual, true)
			})

			Convey("gets nice error if ldap is enabled but not configured", func() {
				setting.LdapEnabled = false

				store := remotecache.NewFakeStore(t)

				auth := New(&Options{
					Store: store,
					Ctx:   ctx,
					OrgID: 4,
				})

				stub := &TestLDAP{
					ID: 42,
				}

				auth.LDAP = func(server *login.LdapServerConf) login.ILdapAuther {
					return stub
				}

				id, err := auth.GetUserID()

				So(err, ShouldNotBeNil)
				So(id, ShouldNotEqual, 42)
				So(stub.syncCalled, ShouldEqual, false)
			})

		})
	})
}
