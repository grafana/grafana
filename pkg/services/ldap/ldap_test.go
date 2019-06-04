package ldap

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	ldap "gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestPublicAPI(t *testing.T) {
	Convey("Users()", t, func() {
		Convey("find one user", func() {
			MockConnection := &MockConnection{}
			entry := ldap.Entry{
				DN: "dn", Attributes: []*ldap.EntryAttribute{
					{Name: "username", Values: []string{"roelgerrits"}},
					{Name: "surname", Values: []string{"Gerrits"}},
					{Name: "email", Values: []string{"roel@test.com"}},
					{Name: "name", Values: []string{"Roel"}},
					{Name: "memberof", Values: []string{"admins"}},
				}}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			MockConnection.setSearchResult(&result)

			// Set up attribute map without surname and email
			server := &Server{
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: MockConnection,
				log:        log.New("test-logger"),
			}

			searchResult, err := server.Users([]string{"roelgerrits"})

			So(err, ShouldBeNil)
			So(searchResult, ShouldNotBeNil)

			// User should be searched in ldap
			So(MockConnection.SearchCalled, ShouldBeTrue)

			// No empty attributes should be added to the search request
			So(len(MockConnection.SearchAttributes), ShouldEqual, 3)
		})
	})

	Convey("InitialBind", t, func() {
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
					BindDN:       "cn=%s,o=users,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := server.InitialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeTrue)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "bindpwd")
		})

		Convey("Given bind dn configured", func() {
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
					BindDN: "cn=%s,o=users,dc=grafana,dc=org",
				},
			}
			err := server.InitialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeFalse)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "pwd")
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
			err := server.InitialBind("user", "pwd")
			So(err, ShouldBeNil)
			So(server.requireSecondBind, ShouldBeTrue)
			So(unauthenticatedBindWasCalled, ShouldBeTrue)
			So(actualUsername, ShouldBeEmpty)
		})
	})
}
