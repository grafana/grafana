package ldap

import (
	"testing"

	"github.com/go-ldap/ldap/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
)

func TestServer_getSearchRequest(t *testing.T) {
	expected := &ldap.SearchRequest{
		BaseDN:       "killa",
		Scope:        2,
		DerefAliases: 0,
		SizeLimit:    0,
		TimeLimit:    0,
		TypesOnly:    false,
		Filter:       "(|)",
		Attributes: []string{
			"username",
			"email",
			"name",
			"memberof",
			"gansta",
		},
		Controls: nil,
	}

	server := &Server{
		Config: &ServerConfig{
			Attr: AttributeMap{
				Username: "username",
				Name:     "name",
				MemberOf: "memberof",
				Email:    "email",
			},
			GroupSearchFilterUserAttribute: "gansta",
			SearchBaseDNs:                  []string{"BaseDNHere"},
		},
		log: log.New("test-logger"),
	}

	result := server.getSearchRequest("killa", []string{"gorilla"})

	assert.EqualValues(t, expected, result)
}

func TestSerializeUsers(t *testing.T) {
	t.Run("simple case", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
					MemberOf: "memberof",
					Email:    "email",
				},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: &MockConnection{},
			log:        log.New("test-logger"),
		}

		entry := ldap.Entry{
			DN: "dn",
			Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"roelgerrits"}},
				{Name: "surname", Values: []string{"Gerrits"}},
				{Name: "email", Values: []string{"roel@test.com"}},
				{Name: "name", Values: []string{"Roel"}},
				{Name: "memberof", Values: []string{"admins"}},
			},
		}
		users := [][]*ldap.Entry{{&entry}}

		result, err := server.serializeUsers(users)
		require.NoError(t, err)

		assert.Equal(t, "roelgerrits", result[0].Login)
		assert.Equal(t, "roel@test.com", result[0].Email)
		assert.Contains(t, result[0].Groups, "admins")
	})

	t.Run("without lastname", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Attr: AttributeMap{
					Username: "username",
					Name:     "name",
					MemberOf: "memberof",
					Email:    "email",
				},
				SearchBaseDNs: []string{"BaseDNHere"},
			},
			Connection: &MockConnection{},
			log:        log.New("test-logger"),
		}

		entry := ldap.Entry{
			DN: "dn",
			Attributes: []*ldap.EntryAttribute{
				{Name: "username", Values: []string{"roelgerrits"}},
				{Name: "email", Values: []string{"roel@test.com"}},
				{Name: "name", Values: []string{"Roel"}},
				{Name: "memberof", Values: []string{"admins"}},
			},
		}
		users := [][]*ldap.Entry{{&entry}}

		result, err := server.serializeUsers(users)
		require.NoError(t, err)

		assert.False(t, result[0].IsDisabled)
		assert.Equal(t, "Roel", result[0].Name)
	})

	t.Run("mark user without matching group as disabled", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Groups: []*GroupToOrgRole{{
					GroupDN: "foo",
					OrgId:   1,
					OrgRole: org.RoleEditor,
				}},
			},
			Connection: &MockConnection{},
			log:        log.New("test-logger"),
		}

		entry := ldap.Entry{
			DN: "dn",
			Attributes: []*ldap.EntryAttribute{
				{Name: "memberof", Values: []string{"admins"}},
			},
		}
		users := [][]*ldap.Entry{{&entry}}

		result, err := server.serializeUsers(users)
		require.NoError(t, err)

		assert.Len(t, result, 1)
		assert.True(t, result[0].IsDisabled)
	})
}

func TestServer_validateGrafanaUser(t *testing.T) {
	t.Run("no group config", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Groups: []*GroupToOrgRole{},
			},
			log: logger.New("test"),
		}

		user := &login.ExternalUserInfo{
			Login: "markelog",
		}

		err := server.validateGrafanaUser(user)
		require.NoError(t, err)
	})

	t.Run("user in group", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Groups: []*GroupToOrgRole{
					{
						OrgId: 1,
					},
				},
			},
			log: logger.New("test"),
		}

		user := &login.ExternalUserInfo{
			Login: "markelog",
			OrgRoles: map[int64]org.RoleType{
				1: "test",
			},
		}

		err := server.validateGrafanaUser(user)
		require.NoError(t, err)
	})

	t.Run("user not in group", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.LDAPAuthEnabled = true

		server := &Server{
			cfg: cfg,
			Config: &ServerConfig{
				Groups: []*GroupToOrgRole{
					{
						OrgId: 1,
					},
				},
			},
			log: logger.New("test"),
		}

		user := &login.ExternalUserInfo{
			Login: "markelog",
		}

		err := server.validateGrafanaUser(user)
		require.ErrorIs(t, err, ErrInvalidCredentials)
	})
}

func TestServer_binds(t *testing.T) {
	t.Run("single bind with cn wildcard", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				BindDN: "cn=%s,dc=grafana,dc=org",
			},
		}

		assert.True(t, server.shouldSingleBind())
		assert.Equal(t, "cn=test,dc=grafana,dc=org", server.singleBindDN("test"))
	})

	t.Run("don't single bind", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				BindDN: "cn=admin,dc=grafana,dc=org",
			},
		}

		assert.False(t, server.shouldSingleBind())
	})

	t.Run("admin user bind", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				BindPassword: "test",
			},
		}

		assert.True(t, server.shouldAdminBind())
	})

	t.Run("don't admin user bind", func(t *testing.T) {
		server := &Server{
			Config: &ServerConfig{
				BindPassword: "",
			},
		}

		assert.False(t, server.shouldAdminBind())
	})
}
