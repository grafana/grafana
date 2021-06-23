package ldap

import (
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/stretchr/testify/require"
	"gopkg.in/ldap.v3"
)

func TestLDAPPrivateMethods(t *testing.T) {
	t.Run("getSearchRequest()", func(t *testing.T) {
		t.Run("with enabled GroupSearchFilterUserAttribute setting", func(t *testing.T) {
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

			So(result, ShouldResemble, &ldap.SearchRequest{
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
			})
		})
	})

	t.Run("serializeUsers()", func(t *testing.T) {
		t.Run("simple case", func(t *testing.T) {
			server := &Server{
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
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			require.NoError(t, err)
			require.Equal(t, "roelgerrits", result[0].Login)
			require.Equal(t, "roel@test.com", result[0].Email)
			So(result[0].Groups, ShouldContain, "admins")
		})

		t.Run("without lastname", func(t *testing.T) {
			server := &Server{
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
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			require.NoError(t, err)
			So(result[0].IsDisabled, ShouldBeFalse)
			require.Equal(t, "Roel", result[0].Name)
		})

		t.Run("a user without matching groups should be marked as disabled", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{{
						GroupDN: "foo",
						OrgId:   1,
						OrgRole: models.ROLE_EDITOR,
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
			users := []*ldap.Entry{&entry}

			result, err := server.serializeUsers(users)

			require.NoError(t, err)
			require.Equal(t, 1, len(result))
			require.True(t, result[0].IsDisabled)
		})
	})

	t.Run("validateGrafanaUser()", func(t *testing.T) {
		t.Run("Returns error when user does not belong in any of the specified LDAP groups", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{
						{
							OrgId: 1,
						},
					},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
			}

			result := server.validateGrafanaUser(user)

			require.Equal(t, ErrInvalidCredentials, result)
		})

		t.Run("Does not return error when group config is empty", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
			}

			result := server.validateGrafanaUser(user)

			So(result, ShouldBeNil)
		})

		t.Run("Does not return error when groups are there", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					Groups: []*GroupToOrgRole{
						{
							OrgId: 1,
						},
					},
				},
				log: logger.New("test"),
			}

			user := &models.ExternalUserInfo{
				Login: "markelog",
				OrgRoles: map[int64]models.RoleType{
					1: "test",
				},
			}

			result := server.validateGrafanaUser(user)

			So(result, ShouldBeNil)
		})
	})

	t.Run("shouldAdminBind()", func(t *testing.T) {
		t.Run("it should require admin userBind", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "test",
				},
			}

			result := server.shouldAdminBind()
			require.True(t, result)
		})

		t.Run("it should not require admin userBind", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					BindPassword: "",
				},
			}

			result := server.shouldAdminBind()
			So(result, ShouldBeFalse)
		})
	})

	t.Run("shouldSingleBind()", func(t *testing.T) {
		t.Run("it should allow single bind", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=%s,dc=grafana,dc=org",
				},
			}

			result := server.shouldSingleBind()
			require.True(t, result)
		})

		t.Run("it should not allow single bind", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=admin,dc=grafana,dc=org",
				},
			}

			result := server.shouldSingleBind()
			So(result, ShouldBeFalse)
		})
	})

	t.Run("singleBindDN()", func(t *testing.T) {
		t.Run("it should allow single bind", func(t *testing.T) {
			server := &Server{
				Config: &ServerConfig{
					BindDN: "cn=%s,dc=grafana,dc=org",
				},
			}

			result := server.singleBindDN("test")
			require.Equal(t, "cn=test,dc=grafana,dc=org", result)
		})
	})
}
