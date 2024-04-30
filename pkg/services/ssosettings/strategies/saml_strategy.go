package strategies

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type SAMLStrategy struct {
	cfg *setting.Cfg
}

var _ ssosettings.FallbackStrategy = (*SAMLStrategy)(nil)

func NewSAMLStrategy(cfg *setting.Cfg) *SAMLStrategy {
	return &SAMLStrategy{
		cfg: cfg,
	}
}

func (s *SAMLStrategy) IsMatch(provider string) bool {
	return provider == social.SAMLProviderName
}

func (s *SAMLStrategy) GetProviderConfig(_ context.Context, provider string) (map[string]any, error) {
	return s.loadSAMLSettings(), nil
}

func (s *SAMLStrategy) loadSAMLSettings() map[string]any {
	section := s.cfg.Raw.Section("auth.saml")
	result := map[string]any{
		"enabled":                    section.Key("enabled").MustBool(false),
		"single_logout":              section.Key("single_logout").MustBool(false),
		"allow_sign_up":              section.Key("allow_sign_up").MustBool(false),
		"auto_login":                 section.Key("auto_login").MustBool(false),
		"certificate":                section.Key("certificate").MustString(""),
		"certificate_path":           section.Key("certificate_path").MustString(""),
		"private_key":                section.Key("private_key").MustString(""),
		"private_key_path":           section.Key("private_key_path").MustString(""),
		"signature_algorithm":        section.Key("signature_algorithm").MustString(""),
		"idp_metadata":               section.Key("idp_metadata").MustString(""),
		"idp_metadata_path":          section.Key("idp_metadata_path").MustString(""),
		"idp_metadata_url":           section.Key("idp_metadata_url").MustString(""),
		"max_issue_delay":            section.Key("max_issue_delay").MustDuration(90 * time.Second),
		"metadata_valid_duration":    section.Key("metadata_valid_duration").MustDuration(48 * time.Hour),
		"allow_idp_initiated":        section.Key("allow_idp_initiated").MustBool(false),
		"relay_state":                section.Key("relay_state").MustString(""),
		"assertion_attribute_name":   section.Key("assertion_attribute_name").MustString(""),
		"assertion_attribute_login":  section.Key("assertion_attribute_login").MustString(""),
		"assertion_attribute_email":  section.Key("assertion_attribute_email").MustString(""),
		"assertion_attribute_groups": section.Key("assertion_attribute_groups").MustString(""),
		"assertion_attribute_role":   section.Key("assertion_attribute_role").MustString(""),
		"assertion_attribute_org":    section.Key("assertion_attribute_org").MustString(""),
		"allowed_organizations":      section.Key("allowed_organizations").MustString(""),
		"org_mapping":                section.Key("org_mapping").MustString(""),
		"role_values_editor":         section.Key("role_values_editor").MustString(""),
		"role_values_admin":          section.Key("role_values_admin").MustString(""),
		"role_values_grafana_admin":  section.Key("role_values_grafana_admin").MustString(""),
		"name_id_format":             section.Key("name_id_format").MustString(""),
		"skip_org_role_sync":         section.Key("skip_org_role_sync").MustBool(false),
		"role_values_none":           section.Key("role_values_none").MustString(""),
	}
	return result
}
