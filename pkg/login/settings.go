package login

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"
	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type LdapConfig struct {
	Servers []*LdapServerConf `toml:"servers"`
}

type LdapServerConf struct {
	Host          string           `toml:"host"`
	Port          int              `toml:"port"`
	UseSSL        bool             `toml:"use_ssl"`
	StartTLS      bool             `toml:"start_tls"`
	SkipVerifySSL bool             `toml:"ssl_skip_verify"`
	RootCACert    string           `toml:"root_ca_cert"`
	BindDN        string           `toml:"bind_dn"`
	BindPassword  string           `toml:"bind_password"`
	Attr          LdapAttributeMap `toml:"attributes"`

	SearchFilter  string   `toml:"search_filter"`
	SearchBaseDNs []string `toml:"search_base_dns"`

	GroupSearchFilter              string   `toml:"group_search_filter"`
	GroupSearchFilterUserAttribute string   `toml:"group_search_filter_user_attribute"`
	GroupSearchBaseDNs             []string `toml:"group_search_base_dns"`

	LdapGroups []*LdapGroupToOrgRole `toml:"group_mappings"`
}

type LdapAttributeMap struct {
	Username string `toml:"username"`
	Name     string `toml:"name"`
	Surname  string `toml:"surname"`
	Email    string `toml:"email"`
	MemberOf string `toml:"member_of"`
}

type LdapGroupToOrgRole struct {
	GroupDN string     `toml:"group_dn"`
	OrgId   int64      `toml:"org_id"`
	OrgRole m.RoleType `toml:"org_role"`
}

var LdapCfg LdapConfig
var ldapLogger log.Logger = log.New("ldap")

func loadLdapConfig() {
	if !setting.LdapEnabled {
		return
	}

	ldapLogger.Info("Ldap enabled, reading config file", "file", setting.LdapConfigFile)

	_, err := toml.DecodeFile(setting.LdapConfigFile, &LdapCfg)
	if err != nil {
		ldapLogger.Crit("Failed to load ldap config file", "error", err)
		os.Exit(1)
	}

	if len(LdapCfg.Servers) == 0 {
		ldapLogger.Crit("ldap enabled but no ldap servers defined in config file")
		os.Exit(1)
	}

	// set default org id
	for _, server := range LdapCfg.Servers {
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
			ldapLogger.Crit("LDAP config file is missing option", "option", propName)
			os.Exit(1)
		}
	case []string:
		if len(v) == 0 {
			ldapLogger.Crit("LDAP config file is missing option", "option", propName)
			os.Exit(1)
		}
	default:
		fmt.Println("unknown")
	}
}
