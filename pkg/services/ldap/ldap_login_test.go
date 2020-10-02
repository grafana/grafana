package ldap

import (
	"errors"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

func TestLDAPLogin(t *testing.T) {
	defaultLogin := &models.LoginUserQuery{
		Username:  "user",
		Password:  "pwd",
		IpAddress: "192.168.1.1:56433",
	}

	Convey("Login()", t, func() {
		Convey("Should get invalid credentials when userBind fails", func() {
			connection := &MockConnection{}
			entry := ldap.Entry{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			connection.BindProvider = func(username, password string) error {
				return &ldap.Error{
					ResultCode: 49,
				}
			}
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			_, err := server.Login(defaultLogin)

			So(err, ShouldEqual, ErrInvalidCredentials)
		})

		Convey("Returns an error when search didn't find anything", func() {
			connection := &MockConnection{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{}}
			connection.setSearchResult(&result)

			connection.BindProvider = func(username, password string) error {
				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			_, err := server.Login(defaultLogin)

			So(err, ShouldEqual, ErrCouldNotFindUser)
		})

		Convey("When search returns an error", func() {
			connection := &MockConnection{}
			expected := errors.New("Killa-gorilla")
			connection.setSearchError(expected)

			connection.BindProvider = func(username, password string) error {
				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			_, err := server.Login(defaultLogin)

			So(err, ShouldEqual, expected)
		})

		Convey("When login with valid credentials", func() {
			connection := &MockConnection{}
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
			connection.setSearchResult(&result)

			connection.BindProvider = func(username, password string) error {
				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					Attr: AttributeMap{
						Username: "username",
						Name:     "name",
						MemberOf: "memberof",
					},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			resp, err := server.Login(defaultLogin)

			So(err, ShouldBeNil)
			So(resp.Login, ShouldEqual, "markelog")
		})

		Convey("Should perform unauthenticated bind without admin", func() {
			connection := &MockConnection{}
			entry := ldap.Entry{
				DN: "test",
			}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			connection.UnauthenticatedBindProvider = func() error {
				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			user, err := server.Login(defaultLogin)

			So(err, ShouldBeNil)
			So(user.AuthId, ShouldEqual, "test")
			So(connection.UnauthenticatedBindCalled, ShouldBeTrue)
		})

		Convey("Should perform authenticated binds", func() {
			connection := &MockConnection{}
			entry := ldap.Entry{
				DN: "test",
			}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			adminUsername := ""
			adminPassword := ""
			username := ""
			password := ""

			i := 0
			connection.BindProvider = func(name, pass string) error {
				i++
				if i == 1 {
					adminUsername = name
					adminPassword = pass
				}

				if i == 2 {
					username = name
					password = pass
				}

				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					BindDN:        "killa",
					BindPassword:  "gorilla",
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			user, err := server.Login(defaultLogin)

			So(err, ShouldBeNil)

			So(user.AuthId, ShouldEqual, "test")
			So(connection.BindCalled, ShouldBeTrue)

			So(adminUsername, ShouldEqual, "killa")
			So(adminPassword, ShouldEqual, "gorilla")

			So(username, ShouldEqual, "test")
			So(password, ShouldEqual, "pwd")
		})
		Convey("Should bind with user if %s exists in the bind_dn", func() {
			connection := &MockConnection{}
			entry := ldap.Entry{
				DN: "test",
			}
			connection.setSearchResult(&ldap.SearchResult{Entries: []*ldap.Entry{&entry}})

			authBindUser := ""
			authBindPassword := ""

			connection.BindProvider = func(name, pass string) error {
				authBindUser = name
				authBindPassword = pass
				return nil
			}
			server := &Server{
				Config: &ServerConfig{
					BindDN:        "cn=%s,ou=users,dc=grafana,dc=org",
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
				log:        log.New("test-logger"),
			}

			_, err := server.Login(defaultLogin)

			So(err, ShouldBeNil)

			So(authBindUser, ShouldEqual, "cn=user,ou=users,dc=grafana,dc=org")
			So(authBindPassword, ShouldEqual, "pwd")
			So(connection.BindCalled, ShouldBeTrue)
		})
	})
}
