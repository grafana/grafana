package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestLDAPHelpers(t *testing.T) {
	Convey("serializeUsers()", t, func() {
		Convey("simple case", func() {
			server := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: &mockConnection{},
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "surname", Values: []string{"Gerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				}}
			users := &ldap.SearchResult{Entries: []*ldap.Entry{&entry}}

			result, err := server.serializeUsers(users)

			So(err, ShouldBeNil)
			So(result[0].Login, ShouldEqual, "roelgerrits")
			So(result[0].Email, ShouldEqual, "roel@test.com")
			So(result[0].Groups, ShouldContain, "admins")
		})

		Convey("without lastname", func() {
			server := &Server{
				config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				connection: &mockConnection{},
				log:        log.New("test-logger"),
			}

			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				}}
			users := &ldap.SearchResult{Entries: []*ldap.Entry{&entry}}

			result, err := server.serializeUsers(users)

			So(err, ShouldBeNil)
			So(result[0].Name, ShouldEqual, "Roel")
		})
	})

	Convey("initialBind", t, func() {
		Convey("Given bind dn and password configured", func() {
			connection := &mockConnection{}
			var actualUsername, actualPassword string
			connection.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			server := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN:       "cn=%s,o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := server.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
			connection := &mockConnection{}
			var actualUsername, actualPassword string
			connection.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			server := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN: "cn=%s,o=users,dc=grafana,dc=org",
				},
			}
			err := server.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeFalse)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "pwd")
		})

		Convey("Given empty bind dn and password", func() {
			connection := &mockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			server := &Server{
				connection: connection,
				config:     &ServerConfig{},
			}
			err := server.initialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeTrue)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})

	Convey("serverBind()", t, func() {
		Convey("Given bind dn and password configured", func() {
			connection := &mockConnection{}
			var actualUsername, actualPassword string
			connection.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			server := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN:       "o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := server.serverBind()
			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
			connection := &mockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			server := &Server{
				connection: connection,
				config: &ServerConfig{
					BindDN: "o=users,dc=grafana,dc=org",
				},
			}
			err := server.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
		})

		Convey("Given empty bind dn and password", func() {
			connection := &mockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			server := &Server{
				connection: connection,
				config:     &ServerConfig{},
			}
			err := server.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})
}
