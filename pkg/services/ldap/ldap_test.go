package ldap

import (
	"errors"
	"fmt"
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

	t.Run("multiple DNs", func(t *testing.T) {
		conn := &MockConnection{}
		serviceDN := "dc=svc,dc=example,dc=org"
		serviceEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"imgrenderer"}},
				{Name: "name", Values: []string{"Image renderer"}},
			}}
		services := ldap.SearchResult{Entries: []*ldap.Entry{&serviceEntry}}

		userDN := "dc=users,dc=example,dc=org"
		userEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot"}},
			}}
		users := ldap.SearchResult{Entries: []*ldap.Entry{&userEntry}}

		conn.setSearchFunc(func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
			switch request.BaseDN {
			case userDN:
				return &users, nil
			case serviceDN:
				return &services, nil
			default:
				return nil, fmt.Errorf("test case not defined for baseDN: '%s'", request.BaseDN)
			}
		})

		server := &Server{
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
				},
				SearchBaseDNs: []string{serviceDN, userDN},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		searchResult, err := server.Users([]string{"imgrenderer", "grot"})
		require.NoError(t, err)

		assert.Len(t, searchResult, 2)
	})

	t.Run("same user in multiple DNs", func(t *testing.T) {
		conn := &MockConnection{}
		firstDN := "dc=users1,dc=example,dc=org"
		firstEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot the First"}},
			}}
		firsts := ldap.SearchResult{Entries: []*ldap.Entry{&firstEntry}}

		secondDN := "dc=users2,dc=example,dc=org"
		secondEntry := ldap.Entry{
			DN: "dn", Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"grot"}},
				{Name: "name", Values: []string{"Grot the Second"}},
			}}
		seconds := ldap.SearchResult{Entries: []*ldap.Entry{&secondEntry}}

		conn.setSearchFunc(func(request *ldap.SearchRequest) (*ldap.SearchResult, error) {
			switch request.BaseDN {
			case secondDN:
				return &seconds, nil
			case firstDN:
				return &firsts, nil
			default:
				return nil, fmt.Errorf("test case not defined for baseDN: '%s'", request.BaseDN)
			}
		})

		server := &Server{
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
				},
				SearchBaseDNs: []string{firstDN, secondDN},
			},
			Connection: conn,
			log:        log.New("test-logger"),
		}

		res, err := server.Users([]string{"grot"})
		require.NoError(t, err)
		require.Len(t, res, 1)
		assert.Equal(t, "Grot the First", res[0].Name)
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
