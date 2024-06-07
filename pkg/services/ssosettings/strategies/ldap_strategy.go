package strategies

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ldap/service"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type LDAPStrategy struct {
	cfg  *setting.Cfg
	ldap service.LDAP
}

var _ ssosettings.FallbackStrategy = (*LDAPStrategy)(nil)

func NewLDAPStrategy(cfg *setting.Cfg, ldap service.LDAP) *LDAPStrategy {
	return &LDAPStrategy{
		cfg:  cfg,
		ldap: ldap,
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

	config := s.ldap.Config()
	configJson, err := json.Marshal(config)
	if err != nil {
		return nil, err
	}

	d := json.NewDecoder(bytes.NewReader(configJson))
	d.UseNumber()
	err = d.Decode(&configMap)
	if err != nil {
		return nil, err
	}

	return configMap, nil
}
