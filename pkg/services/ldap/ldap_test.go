package ldap

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
)

func TestNew(t *testing.T) {
	result := New(&ServerConfig{
		Attr:          AttributeMap{},
		SearchBaseDNs: []string{"BaseDNHere"},
	})

	assert.Implements(t, (*IServer)(nil), result)
}

func TestServer_Close(t *testing.T) {
	t.Run("close the connection", func(t *testing.T) {
		connection := &MockConnection{}

		server := &Server{
			Config: &ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: connection,
		}

		assert.NotPanics(t, server.Close)
		assert.True(t, connection.CloseCalled)
	})

	t.Run("panic if no connection", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				Attr:          AttributeMap{},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: nil,
		}

		assert.Panics(t, server.Close)
	})
}

func TestServer_Users(t *testing.T) {
	t.Run("one user", func(t *testing.T) {
		conn := &MockConnection{}
		entry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"roelgerrits"}},
				{Name: "surname", Values: []string{"Gerrits"}},
				{Name: "email", Values: []string{"roel@test.com"}},
				{Name: "name", Values: []string{"Roel"}},
				{Name: "memberof", Values: []string{"admins"}},
			}}
		result := ldap.SearchResult{Entries: []*ldap.Entry{&entry}}
		conn.setSearchResult(&result)

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
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"roelgerrits"})

		require.NoError(t, err)
		assert.NotNil(t, searchResult)

		// User should be searched in ldap
		assert.True(t, conn.SearchCalled)
		// No empty attributes should be added to the search request
		assert.Len(t, conn.SearchAttributes, 3)
	})

	t.Run("error", func(t *testing.T) {
		expected := errors.New("Killa-gorilla")
		conn := &MockConnection{}
		conn.setSearchError(expected)

		// Set up attribute map without surname and email
		server := &Server{
			Config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		_, err := server.Users([]string{"roelgerrits"})

		assert.ErrorIs(t, err, expected)
	})

	t.Run("no user", func(t *testing.T) {
		conn := &MockConnection{}
		result := ldap.SearchResult{Entries: []*ldap.Entry{}}
		conn.setSearchResult(&result)

		// Set up attribute map without surname and email
		server := &Server{
			Config: &ServerConfig{
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"roelgerrits"})

		require.NoError(t, err)
		assert.Empty(t, searchResult)
	})
}

func TestServer_UserBind(t *testing.T) {
	t.Run("use provided DN and password", func(t *testing.T) {
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
		assert.Equal(t, dn, actualUsername)
		assert.Equal(t, "pwd", actualPassword)
	})

	t.Run("error", func(t *testing.T) {
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
		assert.ErrorIs(t, err, expected)
	})
}

func TestServer_AdminBind(t *testing.T) {
	t.Run("use admin DN and password", func(t *testing.T) {
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

		assert.Equal(t, dn, actualUsername)
		assert.Equal(t, "pwd", actualPassword)
	})

	t.Run("error", func(t *testing.T) {
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
		assert.ErrorIs(t, err, expected)
	})
}
