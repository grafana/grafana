package strategies

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	ldapConfig = `[auth.ldap]
enabled = true
config_file = ./testdata/ldap.toml
allow_sign_up = true
skip_org_role_sync = false
sync_cron = "0 1 * * *"
active_sync_enabled = true`
)

var (
	expectedLdapConfig = map[string]interface{}{
		"enabled":            true,
		"allow_sign_up":      true,
		"skip_org_role_sync": false,
		"config": map[string]interface{}{
			"servers": []interface{}{
				map[string]interface{}{
					"Host": "127.0.0.1",
					"Port": int64(3389),
					"attributes": map[string]interface{}{
						"email":     "mail",
						"member_of": "memberOf",
						"name":      "displayName",
						"surname":   "sn",
						"username":  "cn",
					},
					"bind_dn":       "cn=ldapservice,ou=users,dc=ldap,dc=goauthentik,dc=io",
					"bind_password": "grafana",
					"group_mappings": []interface{}{
						map[string]interface{}{
							"group_dn": "cn=admin,ou=groups,dc=ldap,dc=goauthentik,dc=io",
							"org_id":   int64(1),
							"org_role": "Admin",
						},
						map[string]interface{}{
							"group_dn": "cn=editor,ou=groups,dc=ldap,dc=goauthentik,dc=io",
							"org_id":   int64(1),
							"org_role": "Editor",
						},
						map[string]interface{}{"group_dn": "cn=viewer,ou=groups,dc=ldap,dc=goauthentik,dc=io",
							"org_id":   int64(1),
							"org_role": "Viewer",
						},
					},
					"search_base_dns": []interface{}{
						"DC=ldap,DC=goauthentik,DC=io",
					},
					"search_filter": "(cn=%s)", "ssl_skip_verify": true,
					"timeout": int64(10),
				},
			},
		},
		"active_sync_enabled": true,
		"sync_cron":           "0 1 * * *",
	}
)

func TestGetLDAPConfig(t *testing.T) {
	iniFile, err := ini.Load([]byte(ldapConfig))
	require.NoError(t, err)

	cfg, err := setting.NewCfgFromINIFile(iniFile)
	require.NoError(t, err)

	ldap := service.ProvideService(cfg)

	strategy := NewLDAPStrategy(cfg, ldap)

	result, err := strategy.GetProviderConfig(context.Background(), "ldap")
	require.NoError(t, err)

	require.Equal(t, expectedLdapConfig, result)
}
