package ldap

import (
	"fmt"
	"os"
	"sync"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const defaultTimeout = 10

// Config holds list of connections to LDAP
type Config struct {
	Servers []*ServerConfig `toml:"servers"`
}

// ServerConfig holds connection data to LDAP
type ServerConfig struct {
	Host string `toml:"host"`
	Port int    `toml:"port"`

	UseSSL        bool     `toml:"use_ssl"`
	StartTLS      bool     `toml:"start_tls"`
	SkipVerifySSL bool     `toml:"ssl_skip_verify"`
	MinTLSVersion string   `toml:"min_tls_version"`
	minTLSVersion uint16   `toml:"-"`
	TLSCiphers    []string `toml:"tls_ciphers"`
	tlsCiphers    []uint16 `toml:"-"`

	RootCACert   string       `toml:"root_ca_cert"`
	ClientCert   string       `toml:"client_cert"`
	ClientKey    string       `toml:"client_key"`
	BindDN       string       `toml:"bind_dn"`
	BindPassword string       `toml:"bind_password"`
	Timeout      int          `toml:"timeout"`
	Attr         AttributeMap `toml:"attributes"`

	SearchFilter  string   `toml:"search_filter"`
	SearchBaseDNs []string `toml:"search_base_dns"`

	GroupSearchFilter              string   `toml:"group_search_filter"`
	GroupSearchFilterUserAttribute string   `toml:"group_search_filter_user_attribute"`
	GroupSearchBaseDNs             []string `toml:"group_search_base_dns"`

	Groups []*GroupToOrgRole `toml:"group_mappings"`
}

// AttributeMap is a struct representation for LDAP "attributes" setting
type AttributeMap struct {
	Username string `toml:"username"`
	Name     string `toml:"name"`
	Surname  string `toml:"surname"`
	Email    string `toml:"email"`
	MemberOf string `toml:"member_of"`
}

// GroupToOrgRole is a struct representation of LDAP
// config "group_mappings" setting
type GroupToOrgRole struct {
	GroupDN string `toml:"group_dn"`
	OrgId   int64  `toml:"org_id"`

	// This pointer specifies if setting was set (for backwards compatibility)
	IsGrafanaAdmin *bool `toml:"grafana_admin"`

	OrgRole org.RoleType `toml:"org_role"`
}

// logger for all LDAP stuff
var logger = log.New("ldap")

// loadingMutex locks the reading of the config so multiple requests for reloading are sequential.
var loadingMutex = &sync.Mutex{}

// We need to define in this space so `GetConfig` fn
// could be defined as singleton
var config *Config

// GetConfig returns the LDAP config if LDAP is enabled otherwise it returns nil. It returns either cached value of
// the config or it reads it and caches it first.
func GetConfig(cfg *setting.Cfg) (*Config, error) {
	if cfg != nil {
		if !cfg.LDAPAuthEnabled {
			return nil, nil
		}
	} else if !cfg.LDAPAuthEnabled {
		return nil, nil
	}

	// Make it a singleton
	if config != nil {
		return config, nil
	}

	loadingMutex.Lock()
	defer loadingMutex.Unlock()

	return readConfig(cfg.LDAPConfigFilePath)
}

func readConfig(configFile string) (*Config, error) {
	result := &Config{}

	logger.Info("LDAP enabled, reading config file", "file", configFile)

	// nolint:gosec
	// We can ignore the gosec G304 warning on this one because `filename` comes from grafana configuration file
	fileBytes, err := os.ReadFile(configFile)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Failed to load LDAP config file", err)
	}

	// interpolate full toml string (it can contain ENV variables)
	stringContent, err := setting.ExpandVar(string(fileBytes))
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Failed to expand variables", err)
	}

	_, err = toml.Decode(stringContent, result)
	if err != nil {
		return nil, fmt.Errorf("%v: %w", "Failed to load LDAP config file", err)
	}

	if len(result.Servers) == 0 {
		return nil, fmt.Errorf("LDAP enabled but no LDAP servers defined in config file")
	}

	for _, server := range result.Servers {
		// set default org id
		err = assertNotEmptyCfg(server.SearchFilter, "search_filter")
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "Failed to validate SearchFilter section", err)
		}
		err = assertNotEmptyCfg(server.SearchBaseDNs, "search_base_dns")
		if err != nil {
			return nil, fmt.Errorf("%v: %w", "Failed to validate SearchBaseDNs section", err)
		}

		if server.MinTLSVersion != "" {
			server.minTLSVersion, err = util.TlsNameToVersion(server.MinTLSVersion)
			if err != nil {
				logger.Error("Failed to set min TLS version. Ignoring", "err", err)
			}
		}

		if len(server.TLSCiphers) > 0 {
			server.tlsCiphers, err = util.TlsCiphersToIDs(server.TLSCiphers)
			if err != nil {
				logger.Error("Unrecognized TLS Cipher(s). Ignoring", "err", err)
			}
		}

		for _, groupMap := range server.Groups {
			if groupMap.OrgRole == "" && groupMap.IsGrafanaAdmin == nil {
				return nil, fmt.Errorf("LDAP group mapping: organization role or grafana admin status is required")
			}

			if groupMap.OrgId == 0 {
				groupMap.OrgId = 1
			}
		}

		// set default timeout if unspecified
		if server.Timeout == 0 {
			server.Timeout = defaultTimeout
		}
	}

	return result, nil
}

func assertNotEmptyCfg(val interface{}, propName string) error {
	switch v := val.(type) {
	case string:
		if v == "" {
			return fmt.Errorf("LDAP config file is missing option: %q", propName)
		}
	case []string:
		if len(v) == 0 {
			return fmt.Errorf("LDAP config file is missing option: %q", propName)
		}
	default:
		fmt.Println("unknown")
	}
	return nil
}
