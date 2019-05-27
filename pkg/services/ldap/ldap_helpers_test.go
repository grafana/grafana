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
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: &MockConnection{},
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
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
						Email:    "email",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: &MockConnection{},
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

	Convey("serverBind()", t, func() {
		Convey("Given bind dn and password configured", func() {
			connection := &MockConnection{}
			var actualUsername, actualPassword string
			connection.bindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
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
			connection := &MockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindDN: "o=users,dc=grafana,dc=org",
				},
			}
			err := server.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "o=users,dc=grafana,dc=org")
		})

		Convey("Given empty bind dn and password", func() {
			connection := &MockConnection{}
			unauthenticatedBindWasCalled := false
			var actualUsername string
			connection.unauthenticatedBindProvider = func(username string) error {
				unauthenticatedBindWasCalled = true
				actualUsername = username
				return nil
			}
			server := &Server{
				Connection: connection,
				Config:     &ServerConfig{},
			}
			err := server.serverBind()
			So(err, ShouldBeNil)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})
}
