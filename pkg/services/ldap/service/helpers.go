package service

import (
	"fmt"
	"os"

	"github.com/BurntSushi/toml"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/setting"
)

const defaultTimeout = 10

func readConfig(configFile string) (*ldap.Config, error) {
	result := &ldap.Config{}

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
