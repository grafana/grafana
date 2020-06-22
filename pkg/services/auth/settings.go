package auth

import (
	"io/ioutil"
	"sync"

	"github.com/BurntSushi/toml"
	"golang.org/x/xerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// AuthConfig holds list of connections to LDAP
type AuthConfig struct {
	AuthMappings []*AuthOrgConfig `toml:"auth"`
}

// AuthOrgConfig holds connection data to LDAP
type AuthOrgConfig struct {
	Groups []*GroupToOrgRole `toml:"group_mappings"`
}

// GroupToOrgRole is a struct representation of LDAP
// config "group_mappings" setting
type GroupToOrgRole struct {
	GroupDN string `toml:"group_dn"`
	OrgID   int64  `toml:"org_id"`

	// This pointer specifies if setting was set (for backwards compatibility)
	IsGrafanaAdmin *bool `toml:"grafana_admin"`

	OrgRole string `toml:"org_role"`
}

// logger for all LDAP stuff
var logger = log.New("auth.settings")

// loadingMutex locks the reading of the config so multiple requests for reloading are sequential.
var loadingMutex = &sync.Mutex{}

// IsEnabled checks if ldap is enabled
func IsEnabled() bool {
	return true // TODO revisit if oauth has a setting
	//return setting.LDAPEnabled
}

// ReloadConfig reads the config from the disc and caches it.
func ReloadConfig(configFile string) error {
	if !IsEnabled() {
		return nil
	}

	loadingMutex.Lock()
	defer loadingMutex.Unlock()

	var err error
	config, err = readConfig(configFile)
	return err
}

// We need to define in this space so `GetConfig` fn
// could be defined as singleton
var config *AuthConfig

// GetConfig returns the LDAP config if LDAP is enabled otherwise it returns nil. It returns either cached value of
// the config or it reads it and caches it first.
func GetConfig(configFile string) (*AuthConfig, error) {
	if !IsEnabled() {
		return nil, nil
	}

	// Make it a singleton
	if config != nil {
		return config, nil
	}

	loadingMutex.Lock()
	defer loadingMutex.Unlock()

	var err error
	config, err = readConfig(configFile)

	return config, err
}

func readConfig(configFile string) (*AuthConfig, error) {
	result := &AuthConfig{}

	logger.Info("OAuth Mapping  enabled, reading config file", "file", configFile)

	fileBytes, err := ioutil.ReadFile(configFile)
	if err != nil {
		return nil, errutil.Wrap("Failed to load OAuth Mapping config file", err)
	}

	// interpolate full toml string (it can contain ENV variables)
	stringContent, err := setting.ExpandVar(string(fileBytes))
	if err != nil {
		return nil, errutil.Wrap("Failed to expand variables", err)
	}

	_, err = toml.Decode(stringContent, result)
	if err != nil {
		return nil, errutil.Wrap("Failed to load LDAP config file", err)
	}

	if len(result.AuthMappings) == 0 {
		return nil, xerrors.New("LDAP enabled but no LDAP servers defined in config file")
	}

	// set default org id
	for _, auth := range result.AuthMappings {

		for _, groupMap := range auth.Groups {
			if groupMap.OrgID == 0 {
				groupMap.OrgID = 1
			}
		}
	}

	return result, nil
}
