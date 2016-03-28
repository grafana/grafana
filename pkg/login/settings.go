package login

import (
	"fmt"

	"github.com/BurntSushi/toml"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type LdapConfig struct {
	Servers        []*LdapServerConf `toml:"servers"`
	VerboseLogging bool              `toml:"verbose_logging"`
}

type LdapServerConf struct {
	Host          string           `toml:"host"`
	Port          int              `toml:"port"`
	UseSSL        bool             `toml:"use_ssl"`
	SkipVerifySSL bool             `toml:"ssl_skip_verify"`
	RootCACert    string           `toml:"root_ca_cert"`
	BindDN        string           `toml:"bind_dn"`
	BindPassword  string           `toml:"bind_password"`
	Attr          LdapAttributeMap `toml:"attributes"`

	SearchFilter  string   `toml:"search_filter"`
	SearchBaseDNs []string `toml:"search_base_dns"`

	GroupSearchFilter  string   `toml:"group_search_filter"`
	GroupSearchBaseDNs []string `toml:"group_search_base_dns"`

	LdapGroups []*LdapGroupToOrgRole `toml:"group_mappings"`
}

type LdapAttributeMap struct {
	Username string `toml:"username"`
	Name     string `toml:"name"`
	Surname  string `toml:"surname"`
	Email    string `toml:"email"`
	MemberOf string `toml:"member_of"`
	UID      string `toml:"uid"`
}

type LdapGroupToOrgRole struct {
	GroupDN string     `toml:"group_dn"`
	OrgId   int64      `toml:"org_id"`
	OrgRole m.RoleType `toml:"org_role"`
}

var ldapCfg LdapConfig

func loadLdapConfig() {
	if !setting.LdapEnabled {
		return
	}

	log.Info("Login: Ldap enabled, reading config file: %s", setting.LdapConfigFile)

	_, err := toml.DecodeFile(setting.LdapConfigFile, &ldapCfg)
	if err != nil {
		log.Fatal(3, "Failed to load ldap config file: %s", err)
	}

	if len(ldapCfg.Servers) == 0 {
		log.Fatal(3, "ldap enabled but no ldap servers defined in config file: %s", setting.LdapConfigFile)
	}

	// set default org id
	for _, server := range ldapCfg.Servers {
		assertNotEmptyCfg(server.SearchFilter, "search_filter")
		assertNotEmptyCfg(server.SearchBaseDNs, "search_base_dns")

		for _, groupMap := range server.LdapGroups {
			if groupMap.OrgId == 0 {
				groupMap.OrgId = 1
			}
		}
	}
}

func assertNotEmptyCfg(val interface{}, propName string) {
	switch v := val.(type) {
	case string:
		if v == "" {
			log.Fatal(3, "LDAP config file is missing option: %s", propName)
		}
	case []string:
		if len(v) == 0 {
			log.Fatal(3, "LDAP config file is missing option: %s", propName)
		}
	default:
		fmt.Println("unknown")
	}
}
