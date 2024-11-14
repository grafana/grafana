package ldap

import (
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const DefaultTimeout = 10

// Config holds parameters from the .ini config file
type Config struct {
	Enabled           bool
	ConfigFilePath    string
	AllowSignUp       bool
	SkipOrgRoleSync   bool
	SyncCron          string
	ActiveSyncEnabled bool
}

// ServersConfig holds list of connections to LDAP
type ServersConfig struct {
	Servers []*ServerConfig `toml:"servers" json:"servers"`
}

// ServerConfig holds connection data to LDAP
type ServerConfig struct {
	Host string `toml:"host" json:"host"`
	Port int    `toml:"port" json:"port"`

	UseSSL          bool     `toml:"use_ssl" json:"use_ssl"`
	StartTLS        bool     `toml:"start_tls" json:"start_tls"`
	SkipVerifySSL   bool     `toml:"ssl_skip_verify" json:"ssl_skip_verify"`
	MinTLSVersion   string   `toml:"min_tls_version" json:"min_tls_version"`
	MinTLSVersionID uint16   `toml:"-" json:"-"`
	TLSCiphers      []string `toml:"tls_ciphers" json:"tls_ciphers"`
	TLSCipherIDs    []uint16 `toml:"-" json:"-"`

	RootCACert      string       `toml:"root_ca_cert" json:"root_ca_cert"`
	RootCACertValue []string     `json:"root_ca_cert_value"`
	ClientCert      string       `toml:"client_cert" json:"client_cert"`
	ClientCertValue string       `json:"client_cert_value"`
	ClientKey       string       `toml:"client_key" json:"client_key"`
	ClientKeyValue  string       `json:"client_key_value"`
	BindDN          string       `toml:"bind_dn" json:"bind_dn"`
	BindPassword    string       `toml:"bind_password" json:"bind_password"`
	Timeout         int          `toml:"timeout" json:"timeout"`
	Attr            AttributeMap `toml:"attributes" json:"attributes"`

	SearchFilter  string   `toml:"search_filter" json:"search_filter"`
	SearchBaseDNs []string `toml:"search_base_dns" json:"search_base_dns"`

	GroupSearchFilter              string   `toml:"group_search_filter" json:"group_search_filter"`
	GroupSearchFilterUserAttribute string   `toml:"group_search_filter_user_attribute" json:"group_search_filter_user_attribute"`
	GroupSearchBaseDNs             []string `toml:"group_search_base_dns" json:"group_search_base_dns"`

	Groups []*GroupToOrgRole `toml:"group_mappings" json:"group_mappings"`
}

// AttributeMap is a struct representation for LDAP "attributes" setting
type AttributeMap struct {
	Username string `toml:"username" json:"username"`
	Name     string `toml:"name" json:"name"`
	Surname  string `toml:"surname" json:"surname"`
	Email    string `toml:"email" json:"email"`
	MemberOf string `toml:"member_of" json:"member_of"`
}

// GroupToOrgRole is a struct representation of LDAP
// config "group_mappings" setting
type GroupToOrgRole struct {
	GroupDN string `toml:"group_dn" json:"group_dn"`
	OrgId   int64  `toml:"org_id" json:"org_id"`

	// This pointer specifies if setting was set (for backwards compatibility)
	IsGrafanaAdmin *bool `toml:"grafana_admin" json:"grafana_admin,omitempty"`

	OrgRole org.RoleType `toml:"org_role" json:"org_role"`
}

// logger for all LDAP stuff
var logger = log.New("ldap")

// loadingMutex locks the reading of the config so multiple requests for reloading are sequential.
var loadingMutex = &sync.Mutex{}

// We need to define in this space so `GetConfig` fn
// could be defined as singleton
var cachedConfig struct {
	config       *ServersConfig
	filePath     string
	fileModified time.Time
}

func GetLDAPConfig(cfg *setting.Cfg) *Config {
	return &Config{
		Enabled:           cfg.LDAPAuthEnabled,
		ConfigFilePath:    cfg.LDAPConfigFilePath,
		AllowSignUp:       cfg.LDAPAllowSignup,
		SkipOrgRoleSync:   cfg.LDAPSkipOrgRoleSync,
		SyncCron:          cfg.LDAPSyncCron,
		ActiveSyncEnabled: cfg.LDAPActiveSyncEnabled,
	}
}

// GetConfig returns the LDAP config if LDAP is enabled otherwise it returns nil. It returns either cached value of
// the config or it reads it and caches it first.
func GetConfig(cfg *Config) (*ServersConfig, error) {
	if cfg == nil || !cfg.Enabled {
		return nil, nil
	}

	configFileStats, err := os.Stat(cfg.ConfigFilePath)
	if err != nil {
		return nil, err
	}
	configFileModified := configFileStats.ModTime()

	// return the config from cache if the config file hasn't been modified
	if cachedConfig.config != nil && cachedConfig.filePath == cfg.ConfigFilePath && cachedConfig.fileModified.Equal(configFileModified) {
		return cachedConfig.config, nil
	}

	loadingMutex.Lock()
	defer loadingMutex.Unlock()

	cachedConfig.config, err = readConfig(cfg.ConfigFilePath)
	if err == nil {
		cachedConfig.filePath = cfg.ConfigFilePath
		cachedConfig.fileModified = configFileModified
	}

	return cachedConfig.config, err
}

func readConfig(configFile string) (*ServersConfig, error) {
	result := &ServersConfig{}

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
			server.MinTLSVersionID, err = util.TlsNameToVersion(server.MinTLSVersion)
			if err != nil {
				logger.Error("Failed to set min TLS version. Ignoring", "err", err)
			}
		}

		if len(server.TLSCiphers) > 0 {
			server.TLSCipherIDs, err = util.TlsCiphersToIDs(server.TLSCiphers)
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
			server.Timeout = DefaultTimeout
		}
	}

	return result, nil
}

func assertNotEmptyCfg(val any, propName string) error {
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
