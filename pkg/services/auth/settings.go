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

// GroupToOrgRole is a struct representation, kept similar to LDAP to facilitate  LDAP->OIDC provider migrations.
// config "group_mappings" setting:
type GroupToOrgRole struct {
	GroupDN string `toml:"group_dn"`
	OrgID   int64  `toml:"org_id"`

	// This pointer specifies if setting was set (for backwards compatibility)
	IsGrafanaAdmin *bool `toml:"grafana_admin"`

	OrgRole string `toml:"org_role"`
}

// logger for all auth settings
var logger = log.New("auth.settings")

// loadingMutex locks the reading of the config so multiple requests for reloading are sequential.
var loadingMutex = &sync.Mutex{}

// We need to define in this space so `GetConfig` fn
// could be defined as singleton
var config *AuthConfig

// GetConfig returns the auth config represented by the configFile.
func GetConfig(configFile string) (*AuthConfig, error) {
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
		return nil, errutil.Wrap("Failed to load Auth config file", err)
	}

	if len(result.AuthMappings) == 0 {
		return nil, xerrors.New("Auth Group mappings enabled, but none have loaded.")
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
