package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/log"
)

func TestLdapLogin(t *testing.T) {
	Convey("Login using ldap", t, func() {
		AuthScenario("When login with invalid credentials", func(scenario *scenarioContext) {
			conn := &mockLdapConn{}
			entry := ldap.Entry{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			conn.setSearchResult(&result)

			conn.bindProvider = func(username, password string) error {
				return &ldap.Error{
					ResultCode: 49,
				}
			}
			auth := &Auth{
				server: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				conn: conn,
				log:  log.New("test-logger"),
			}

			err := auth.Login(scenario.loginUserQuery)

			Convey("it should return invalid credentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})
		})

		AuthScenario("When login with valid credentials", func(scenario *scenarioContext) {
			conn := &mockLdapConn{}
			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"markelog"}},
					{Name: "surname", Values: []string{"Gaidarenko"}},
					{Name: "email", Values: []string{"markelog@gmail.com"}},
					{Name: "name", Values: []string{"Oleg"}},
					{Name: "memberof", Values: []string{"admins"}},
				},
			}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			conn.setSearchResult(&result)

			conn.bindProvider = func(username, password string) error {
				return nil
			}
			auth := &Auth{
				server: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				conn: conn,
				log:  log.New("test-logger"),
			}

			err := auth.Login(scenario.loginUserQuery)

			Convey("it should not return error", func() {
				So(err, ShouldBeNil)
			})

			Convey("it should get user", func() {
				So(scenario.loginUserQuery.User.Login, ShouldEqual, "markelog")
			})
		})
	})
}
