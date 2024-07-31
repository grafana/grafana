package service

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/services/ldap"
)

func resolveBool(input any, defaultValue bool) bool {
	strInput := fmt.Sprintf("%v", input)
	result, err := strconv.ParseBool(strInput)
	if err != nil {
		return defaultValue
	}
	return result
}

func resolveServerConfig(input any) (*ldap.ServersConfig, error) {
	var ldapCfg ldap.ServersConfig

	inputJson, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}

	if err = json.Unmarshal(inputJson, &ldapCfg); err != nil {
		return nil, err
	}

	return &ldapCfg, nil
}
