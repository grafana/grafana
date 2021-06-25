package ldap

import (
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/stretchr/testify/require"
	"gopkg.in/ldap.v3"
)

func TestPublicAPI(t *testing.T) {
	t.Run("New()", func(t *testing.T) {
		t.Run("Should return ", func(t *testing.T) {
			result := New(&ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			})

			require.Implements(t, (*IServer)(nil), result)
		})
	})

	t.Run("Close()", func(t *testing.T) {
		t.Run("Should close the connection", func(t *testing.T) {
			connection := &MockConnection{}

			server := &Server{
				Config: &ServerConfig{
					Attr:          AttributeMap{},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: connection,
			}

			require.NotPanics(t, server.Close)
			require.True(t, connection.CloseCalled)
		})

		t.Run("Should panic if no connection is established", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					Attr:          AttributeMap{},
					SearchBaseDNs: []string{"BaseDNHere"},
				},
				Connection: nil,
			}

			require.Panics(t, server.Close)
		})
	})
	t.Run("Users()", func(t *testing.T) {
		t.Run("Finds one user", func(t *testing.T) {
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

			require.NoError(t, err)
			require.NotNil(t, searchResult)

			// User should be searched in ldap
			require.True(t, MockConnection.SearchCalled)

			// No empty attributes should be added to the search request
			require.Equal(t, 3, len(MockConnection.SearchAttributes))
		})

		t.Run("Handles a error", func(t *testing.T) {
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

			require.Equal(t, expected, err)
		})

		t.Run("Should return empty slice if none were found", func(t *testing.T) {
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

			require.NoError(t, err)
			require.Empty(t, searchResult)
		})
	})

	t.Run("UserBind()", func(t *testing.T) {
		t.Run("Should use provided DN and password", func(t *testing.T) {
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

			require.NoError(t, err)
			require.Equal(t, dn, actualUsername)
			require.Equal(t, "pwd", actualPassword)
		})

		t.Run("Should handle an error", func(t *testing.T) {
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
			require.Equal(t, expected, err)
		})
	})

	t.Run("AdminBind()", func(t *testing.T) {
		t.Run("Should use admin DN and password", func(t *testing.T) {
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

			require.NoError(t, err)
			require.Equal(t, dn, actualUsername)
			require.Equal(t, "pwd", actualPassword)
		})

		t.Run("Should handle an error", func(t *testing.T) {
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
			require.Equal(t, expected, err)
		})
	})
}
