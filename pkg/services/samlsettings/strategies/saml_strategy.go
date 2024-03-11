package strategies

import (
	"context"
	"fmt"
	"maps"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/samlsettings"
	"github.com/grafana/grafana/pkg/setting"
)

type SAMLStrategy struct {
	cfg                *setting.Cfg
	settingsByProvider map[string]map[string]any
}

var extraKeysByProvider = map[string]map[string]connectors.ExtraKeyInfo{
	// TODO: connector implementation
}

var _ samlsettings.FallbackStrategy = (*SAMLStrategy)(nil)

func NewSAMLStrategy(cfg *setting.Cfg) *SAMLStrategy {
	samlStrategy := &SAMLStrategy{
		cfg:                cfg,
		settingsByProvider: make(map[string]map[string]any),
	}

	samlStrategy.loadAllSettings()
	return samlStrategy
}

func (s *SAMLStrategy) IsMatch(provider string) bool {
	_, ok := s.settingsByProvider[provider]
	return ok
}

func (s *SAMLStrategy) GetProviderConfig(_ context.Context, provider string) (map[string]any, error) {
	fmt.Println("provider", provider)
	providerConfig := s.settingsByProvider[provider]
	result := make(map[string]any, len(providerConfig))
	maps.Copy(result, providerConfig)
	return result, nil
}

func (s *SAMLStrategy) loadAllSettings() {
	allProviders := append(samlsettings.AllSAMLProviders, "saml")
	for _, provider := range allProviders {
		settings := s.loadSettingsForProvider(provider)
		if provider == "saml" && s.shouldUseGrafanaNetSettings() && settings["enabled"] == true { // TODO remove == true
			provider = social.GrafanaComProviderName
		}
		s.settingsByProvider[provider] = settings
	}
}

func (s *SAMLStrategy) shouldUseGrafanaNetSettings() bool {
	return s.settingsByProvider[social.GrafanaComProviderName]["enabled"] == false
}

func (s *SAMLStrategy) loadSettingsForProvider(provider string) map[string]any {
	section := s.cfg.Raw.Section("auth." + provider)

	result := map[string]any{
		"enabled":                    section.Key("enabled").MustBool(false),
		"single_logout":              section.Key("single_logout").MustBool(false),
		"allow_sign_up":              section.Key("allow_sign_up").MustBool(false),
		"auto_login":                 section.Key("auto_login").MustBool(false),
		"certificate":                section.Key("certificate").String(),
		"certificate_path":           section.Key("certificate_path").String(),
		"private_key":                section.Key("private_key").String(),
		"private_key_path":           section.Key("private_key_path").String(),
		"signature_algorithm":        section.Key("signature_algorithm").String(),
		"idp_metadata":               section.Key("idp_metadata").String(),
		"idp_metadata_path":          section.Key("idp_metadata_path").String(),
		"idp_metadata_url":           section.Key("idp_metadata_url").String(),
		"max_issue_delay":            section.Key("max_issue_delay").String(),
		"metadata_valid_duration":    section.Key("metadata_valid_duration").String(),
		"allow_idp_initiated":        section.Key("allow_idp_initiated").MustBool(false),
		"relay_state":                section.Key("relay_state").String(),
		"assertion_attribute_name":   section.Key("assertion_attribute_name").String(),
		"assertion_attribute_login":  section.Key("assertion_attribute_login").String(),
		"assertion_attribute_email":  section.Key("assertion_attribute_email").String(),
		"assertion_attribute_groups": section.Key("assertion_attribute_groups").String(),
		"assertion_attribute_role":   section.Key("assertion_attribute_role").String(),
		"assertion_attribute_org":    section.Key("assertion_attribute_org").String(),
		"allowed_organizations":      section.Key("allowed_organizations").String(),
		"org_mapping":                section.Key("org_mapping").String(),
		"role_values_editor":         section.Key("role_values_editor").String(),
		"role_values_admin":          section.Key("role_values_admin").String(),
		"role_values_grafana_admin":  section.Key("role_values_grafana_admin").String(),
		"name_id_format":             section.Key("name_id_format").String(),
		"skip_org_role_sync":         section.Key("skip_org_role_sync").MustBool(false),
		"role_values_none":           section.Key("role_values_none").String(),
	}

	extraKeys := extraKeysByProvider[provider]
	for key, keyInfo := range extraKeys {
		switch keyInfo.Type {
		case connectors.Bool:
			result[key] = section.Key(key).MustBool(keyInfo.DefaultValue.(bool))
		default:
			if _, ok := keyInfo.DefaultValue.(string); !ok {
				result[key] = section.Key(key).Value()
			} else {
				result[key] = section.Key(key).MustString(keyInfo.DefaultValue.(string))
			}
		}
	}

	return result
}
