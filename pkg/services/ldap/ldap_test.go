package ldap

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"
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

	Convey("Close()", t, func() {
		Convey("Should close the connection", func() {
			connection := &MockConnection{}

			server := &Server{
				Config: &ServerConfig{
					Attr:          AttributeMap{},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
			}

			So(server.Close, ShouldNotPanic)
			So(connection.CloseCalled, ShouldBeTrue)
		})

		Convey("Should panic if no connection is established", func() {
			server := &Server{
				Config: &ServerConfig{
					Attr:          AttributeMap{},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: nil,
			}

			So(server.Close, ShouldPanic)
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

	Convey("UserBind()", t, func() {
		Convey("Should use provided DN and password", func() {
			connection := &MockConnection{}
			var actualUsername, actualPassword string
			connection.BindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}
			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindDN: "cn=admin,dc=grafana,dc=org",
				},
			}

			dn := "cn=user,ou=users,dc=grafana,dc=org"
			err := server.UserBind(dn, "pwd")

			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, dn)
			So(actualPassword, ShouldEqual, "pwd")
		})

		Convey("Should handle an error", func() {
			connection := &MockConnection{}
			expected := &ldap.Error{
				ResultCode: uint16(25),
			}
			connection.BindProvider = func(username, password string) error {
				return expected
			}
			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindDN: "cn=%s,ou=users,dc=grafana,dc=org",
				},
				log: log.New("test-logger"),
			}
			err := server.UserBind("user", "pwd")
			So(err, ShouldEqual, expected)
		})
	})

	Convey("AdminBind()", t, func() {
		Convey("Should use admin DN and password", func() {
			connection := &MockConnection{}
			var actualUsername, actualPassword string
			connection.BindProvider = func(username, password string) error {
				actualUsername = username
				actualPassword = password
				return nil
			}

			dn := "cn=admin,dc=grafana,dc=org"

			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindPassword: "pwd",
					BindDN:       dn,
				},
			}

			err := server.AdminBind()

			So(err, ShouldBeNil)
			So(actualUsername, ShouldEqual, dn)
			So(actualPassword, ShouldEqual, "pwd")
		})

		Convey("Should handle an error", func() {
			connection := &MockConnection{}
			expected := &ldap.Error{
				ResultCode: uint16(25),
			}
			connection.BindProvider = func(username, password string) error {
				return expected
			}

			dn := "cn=admin,dc=grafana,dc=org"

			server := &Server{
				Connection: connection,
				Config: &ServerConfig{
					BindPassword: "pwd",
					BindDN:       dn,
				},
				log: log.New("test-logger"),
			}

			err := server.AdminBind()
			So(err, ShouldEqual, expected)
		})
	})
}
