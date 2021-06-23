package ldap

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
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

	t.Run("Login()", func(t *testing.T) {
		t.Run("Should get invalid credentials when userBind fails", func(t *testing.T) {
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

			require.Equal(t, ErrInvalidCredentials, err)
		})

		t.Run("Returns an error when search didn't find anything", func(t *testing.T) {
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

			require.Equal(t, ErrCouldNotFindUser, err)
		})

		t.Run("When search returns an error", func(t *testing.T) {
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

			require.Equal(t, expected, err)
		})

		t.Run("When login with valid credentials", func(t *testing.T) {
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
			require.Equal(t, "markelog", resp.Login)
		})

		t.Run("Should perform unauthenticated bind without admin", func(t *testing.T) {
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
			require.Equal(t, "test", user.AuthId)
			require.True(t, connection.UnauthenticatedBindCalled)
		})

		t.Run("Should perform authenticated binds", func(t *testing.T) {
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

			require.Equal(t, "test", user.AuthId)
			require.True(t, connection.BindCalled)

			require.Equal(t, "killa", adminUsername)
			require.Equal(t, "gorilla", adminPassword)

			require.Equal(t, "test", username)
			require.Equal(t, "pwd", password)
		})
		t.Run("Should bind with user if %s exists in the bind_dn", func(t *testing.T) {
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

			require.Equal(t, "cn=user,ou=users,dc=grafana,dc=org", authBindUser)
			require.Equal(t, "pwd", authBindPassword)
			require.True(t, connection.BindCalled)
		})
	})
}
