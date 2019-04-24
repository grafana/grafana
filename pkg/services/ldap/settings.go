package ldap

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/log"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
)

type Config struct {
	Servers []*LdapServerConf `toml:"servers"`
}

type LdapServerConf struct {
	Host          string           `toml:"host"`
	Port          int              `toml:"port"`
	UseSSL        bool             `toml:"use_ssl"`
	StartTLS      bool             `toml:"start_tls"`
	SkipVerifySSL bool             `toml:"ssl_skip_verify"`
	RootCACert    string           `toml:"root_ca_cert"`
	ClientCert    string           `toml:"client_cert"`
	ClientKey     string           `toml:"client_key"`
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
	GroupDN        string     `toml:"group_dn"`
	OrgId          int64      `toml:"org_id"`
	IsGrafanaAdmin *bool      `toml:"grafana_admin"` // This is a pointer to know if it was set or not (for backwards compatibility)
	OrgRole        m.RoleType `toml:"org_role"`
}

var config *Config
var logger = log.New("ldap")

// IsEnabled checks if ldap is enabled
func IsEnabled() bool {
	return setting.LdapEnabled
}

// ReadConfig reads the config if ldap is enabled
func ReadConfig() (bool, *Config) {
	if IsEnabled() == false {
		return false, nil
	}

	// Make it a singleton
	if config != nil {
		return false, config
	}

	getConfig(setting.LdapConfigFile, config)

	return true, config
}

func getConfig(configFile string, config *Config) {
	logger.Info("Ldap enabled, reading config file", "file", configFile)

	_, err := toml.DecodeFile(configFile, config)
	if err != nil {
		logger.Crit("Failed to load ldap config file", "error", err)
		os.Exit(1)
	}

	if len(config.Servers) == 0 {
		logger.Crit("ldap enabled but no ldap servers defined in config file")
		os.Exit(1)
	}

	// set default org id
	for _, server := range config.Servers {
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
			logger.Crit("LDAP config file is missing option", "option", propName)
			os.Exit(1)
		}
	case []string:
		if len(v) == 0 {
			logger.Crit("LDAP config file is missing option", "option", propName)
			os.Exit(1)
		}
	default:
		fmt.Println("unknown")
	}
}
