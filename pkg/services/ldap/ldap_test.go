package ldap

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestPublicAPI(t *testing.T) {
	Convey("New()", t, func() {
		Convey("Should return ", func() {
			result := New(&ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			})

			So(result, ShouldImplement, (*IServer)(nil))
		})
	})

	Convey("Users()", t, func() {
		Convey("Finds one user", func() {
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

		Convey("Handles a error", func() {
			expected := errors.New("Killa-gorilla")
			MockConnection := &MockConnection{}
			MockConnection.setSearchError(expected)

			// Set up attribute map without surname and email
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: MockConnection,
				log:        log.New("test-logger"),
			}

			_, err := server.Users([]string{"roelgerrits"})

			So(err, ShouldEqual, expected)
		})

		Convey("Should return empty slice if none were found", func() {
			MockConnection := &MockConnection{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{}}
			MockConnection.setSearchResult(&result)

			// Set up attribute map without surname and email
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: MockConnection,
				log:        log.New("test-logger"),
			}

			searchResult, err := server.Users([]string{"roelgerrits"})

			So(err, ShouldBeNil)
			So(searchResult, ShouldBeEmpty)
		})
	})

	Convey("Auth()", t, func() {
		Convey("Should ignore passsed username and password", func() {
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
					BindDN:       "cn=admin,dc=grafana,dc=org",
					BindPassword: "bindpwd",
				},
			}
			err := server.Auth("user", "pwd")
			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, "cn=admin,dc=grafana,dc=org")
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
			err := server.Auth("user", "pwd")
			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, "cn=user,o=users,dc=grafana,dc=org")
			So(actualPassword, ShouldEqual, "pwd")
		})

		Convey("Should handle an error", func() {
			connection := &MockConnection{}
			expected := &ldap.Error{
				ResultCode: uint16(25),
			}
			connection.bindProvider = func(username, password string) error {
				return expected
			}
			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindDN: "cn=%s,o=users,dc=grafana,dc=org",
				},
				log: log.New("test-logger"),
			}
			err := server.Auth("user", "pwd")
			So(err, ShouldEqual, expected)
		})
	})
}
