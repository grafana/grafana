package ldap

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"gopkg.in/ldap.v3"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
)

var defaultLogin = &models.LoginUserQuery{
	Username:  "user",
	Password:  "pwd",
	IpAddress: "192.168.1.1:56433",
}

func TestServer_Login_UserBind_Fail(t *testing.T) {
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

	assert.ErrorIs(t, err, ErrInvalidCredentials)
}

func TestServer_Login_Search_NoResult(t *testing.T) {
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
	assert.ErrorIs(t, err, ErrCouldNotFindUser)
}

func TestServer_Login_Search_Error(t *testing.T) {
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
	assert.ErrorIs(t, err, expected)
}

func TestServer_Login_ValidCredentials(t *testing.T) {
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
	require.NoError(t, err)
	assert.Equal(t, "markelog", resp.Login)
}

// TestServer_Login_UnauthenticatedBind tests that unauthenticated bind
// is called when there is no admin password or user wildcard in the
// bind_dn.
func TestServer_Login_UnauthenticatedBind(t *testing.T) {
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
	require.NoError(t, err)
	assert.Equal(t, "test", user.AuthId)
	assert.True(t, connection.UnauthenticatedBindCalled)
}

func TestServer_Login_AuthenticatedBind(t *testing.T) {
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
	require.NoError(t, err)

	assert.Equal(t, "test", user.AuthId)
	assert.True(t, connection.BindCalled)

	assert.Equal(t, "killa", adminUsername)
	assert.Equal(t, "gorilla", adminPassword)

	assert.Equal(t, "test", username)
	assert.Equal(t, "pwd", password)
}

func TestServer_Login_UserWildcardBind(t *testing.T) {
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
	require.NoError(t, err)

	assert.Equal(t, "cn=user,ou=users,dc=grafana,dc=org", authBindUser)
	assert.Equal(t, "pwd", authBindPassword)
	assert.True(t, connection.BindCalled)
}
