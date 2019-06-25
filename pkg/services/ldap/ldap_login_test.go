package ldap

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/ldap.v3"
)

func TestLDAPLogin(t *testing.T) {
	defaultLogin := &models.LoginUserQuery{
		Username:  "user",
		Password:  "pwd",
		IpAddress: "192.168.1.1:56433",
	}

	Convey("Login()", t, func() {
		Convey("Should get invalid credentials when auth fails", func() {
			connection := &MockConnection{}
			entry := ldap.Entry{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
			connection.setSearchResult(&result)

			connection.bindProvider = func(username, password string) error {
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

		Convey("Returns an error when search hasn't find anything", func() {
			connection := &MockConnection{}
			result := ldap.SearchResult{Entries: []*ldap.Entry{}}
			connection.setSearchResult(&result)

			connection.bindProvider = func(username, password string) error {
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

			So(err, ShouldEqual, ErrInvalidCredentials)
		})

		Convey("When search returns an error", func() {
			connection := &MockConnection{}
			expected := errors.New("Killa-gorilla")
			connection.setSearchError(expected)

			connection.bindProvider = func(username, password string) error {
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

			connection.bindProvider = func(username, password string) error {
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
	})
}
