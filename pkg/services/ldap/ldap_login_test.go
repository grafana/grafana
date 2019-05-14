package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
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

		AuthScenario("When user not found in LDAP, but exist in Grafana", func(scenario *scenarioContext) {
			conn := &mockLdapConn{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{}}
			conn.setSearchResult(&result)

			externalUser := &models.ExternalUserInfo{UserId: 42, IsDisabled: false}
			scenario.getExternalUserInfoByLoginQueryReturns(externalUser)

			conn.bindProvider = func(username, password string) error {
				return nil
			}
			auth := &Auth{
				server: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				conn: conn,
				log:  log.New("test-logger"),
			}

			err := auth.Login(scenario.loginUserQuery)

			Convey("it should disable user", func() {
				So(scenario.disableExternalUserCalled, ShouldBeTrue)
				So(scenario.disableUserCmd.IsDisabled, ShouldBeTrue)
				So(scenario.disableUserCmd.UserId, ShouldEqual, 42)
			})

			Convey("it should return invalid credentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})
		})

		AuthScenario("When user not found in LDAP, and disabled in Grafana already", func(scenario *scenarioContext) {
			conn := &mockLdapConn{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{}}
			conn.setSearchResult(&result)

			externalUser := &models.ExternalUserInfo{UserId: 42, IsDisabled: true}
			scenario.getExternalUserInfoByLoginQueryReturns(externalUser)

			conn.bindProvider = func(username, password string) error {
				return nil
			}
			auth := &Auth{
				server: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				conn: conn,
				log:  log.New("test-logger"),
			}

			err := auth.Login(scenario.loginUserQuery)

			Convey("it should't call disable function", func() {
				So(scenario.disableExternalUserCalled, ShouldBeFalse)
			})

			Convey("it should return invalid credentials error", func() {
				So(err, ShouldEqual, ErrInvalidCredentials)
			})
		})

		AuthScenario("When user found in LDAP, and disabled in Grafana", func(scenario *scenarioContext) {
			conn := &mockLdapConn{}
			entry := ldap.Entry{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			conn.setSearchResult(&result)
			scenario.userQueryReturns(&models.User{Id: 42, IsDisabled: true})

			conn.bindProvider = func(username, password string) error {
				return nil
			}
			auth := &Auth{
				server: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				conn: conn,
				log:  log.New("test-logger"),
			}

			err := auth.Login(scenario.loginUserQuery)

			Convey("it should re-enable user", func() {
				So(scenario.disableExternalUserCalled, ShouldBeTrue)
				So(scenario.disableUserCmd.IsDisabled, ShouldBeFalse)
				So(scenario.disableUserCmd.UserId, ShouldEqual, 42)
			})

			Convey("it should not return error", func() {
				So(err, ShouldBeNil)
			})
		})
	})
}
