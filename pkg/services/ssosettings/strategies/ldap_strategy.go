package strategies

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ldap"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type LDAPStrategy struct {
	cfg *setting.Cfg
}

var _ ssosettings.FallbackStrategy = (*LDAPStrategy)(nil)

func NewLDAPStrategy(cfg *setting.Cfg) *LDAPStrategy {
	return &LDAPStrategy{
		cfg: cfg,
	}
}

func (s *LDAPStrategy) IsMatch(provider string) bool {
	return provider == social.LDAPProviderName
}

func (s *LDAPStrategy) GetProviderConfig(_ context.Context, _ string) (map[string]any, error) {
	config, err := s.getLDAPConfig()
	if err != nil {
		return nil, err
	}

	section := s.cfg.Raw.Section("auth.ldap")

	result := map[string]any{
		"enabled":             section.Key("enabled").MustBool(false),
		"config":              config,
		"allow_sign_up":       section.Key("allow_sign_up").MustBool(false),
		"skip_org_role_sync":  section.Key("skip_org_role_sync").MustBool(false),
		"sync_cron":           section.Key("sync_cron").Value(),
		"active_sync_enabled": section.Key("active_sync_enabled").MustBool(false),
	}

	return result, nil
}

func (s *LDAPStrategy) getLDAPConfig() (map[string]any, error) {
	var configMap map[string]any

	config := ldap.GetLDAPConfig(s.cfg)
	ldapConfig, err := ldap.GetConfig(config)
	if err != nil {
		return nil, err
	}

	configJson, err := json.Marshal(ldapConfig)
	if err != nil {
		return nil, err
	}

	d := json.NewDecoder(bytes.NewReader(configJson))
	d.UseNumber()
	err = d.Decode(&configMap)
	if err != nil {
		return nil, err
	}

	// json decodes numbers as json.Number type
	// this iterates over all items in the map and returns a new map
	// with all json.Number replaced by int64
	result, err := replaceNumbersInMap(configMap)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func replaceNumbersInMap(m map[string]any) (map[string]any, error) {
	var err error

	result := make(map[string]any)
	for k, v := range m {
		switch v := v.(type) {
		case json.Number:
			result[k], err = v.Int64()
			if err != nil {
				return nil, err
			}
		case []any:
			result[k], err = replaceNumbersInSlice(v)
			if err != nil {
				return nil, err
			}
		case map[string]any:
			result[k], err = replaceNumbersInMap(v)
			if err != nil {
				return nil, err
			}
		default:
			result[k] = v
		}
	}

	return result, nil
}

func replaceNumbersInSlice(s []any) ([]any, error) {
	result := make([]any, 0)
	for _, v := range s {
		switch v := v.(type) {
		case json.Number:
			number, err := v.Int64()
			if err != nil {
				return nil, err
			}
			result = append(result, number)
		case []any:
			inner, err := replaceNumbersInSlice(v)
			if err != nil {
				return nil, err
			}
			result = append(result, inner)
		case map[string]any:
			inner, err := replaceNumbersInMap(v)
			if err != nil {
				return nil, err
			}
			result = append(result, inner)
		default:
			result = append(result, v)
		}
	}

	return result, nil
}
