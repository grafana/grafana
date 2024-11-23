package strategies

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type SAMLStrategy struct {
	settingsProvider setting.Provider
}

var _ ssosettings.FallbackStrategy = (*SAMLStrategy)(nil)

func NewSAMLStrategy(settingsProvider setting.Provider) *SAMLStrategy {
	return &SAMLStrategy{
		settingsProvider: settingsProvider,
	}
}

func (s *SAMLStrategy) IsMatch(provider string) bool {
	return provider == social.SAMLProviderName
}

func (s *SAMLStrategy) GetProviderConfig(_ context.Context, provider string) (map[string]any, error) {
	return s.loadSAMLSettings(), nil
}

func (s *SAMLStrategy) loadSAMLSettings() map[string]any {
	section := s.settingsProvider.Section("auth.saml")
	result := map[string]any{
		"enabled":                    section.KeyValue("enabled").MustBool(false),
		"entity_id":                  section.KeyValue("entity_id").MustString(""),
		"name":                       section.KeyValue("name").MustString("SAML"),
		"single_logout":              section.KeyValue("single_logout").MustBool(false),
		"allow_sign_up":              section.KeyValue("allow_sign_up").MustBool(false),
		"auto_login":                 section.KeyValue("auto_login").MustBool(false),
		"certificate":                section.KeyValue("certificate").MustString(""),
		"certificate_path":           section.KeyValue("certificate_path").MustString(""),
		"private_key":                section.KeyValue("private_key").MustString(""),
		"private_key_path":           section.KeyValue("private_key_path").MustString(""),
		"signature_algorithm":        section.KeyValue("signature_algorithm").MustString(""),
		"idp_metadata":               section.KeyValue("idp_metadata").MustString(""),
		"idp_metadata_path":          section.KeyValue("idp_metadata_path").MustString(""),
		"idp_metadata_url":           section.KeyValue("idp_metadata_url").MustString(""),
		"max_issue_delay":            section.KeyValue("max_issue_delay").MustDuration(90 * time.Second),
		"metadata_valid_duration":    section.KeyValue("metadata_valid_duration").MustDuration(48 * time.Hour),
		"allow_idp_initiated":        section.KeyValue("allow_idp_initiated").MustBool(false),
		"relay_state":                section.KeyValue("relay_state").MustString(""),
		"assertion_attribute_name":   section.KeyValue("assertion_attribute_name").MustString(""),
		"assertion_attribute_login":  section.KeyValue("assertion_attribute_login").MustString(""),
		"assertion_attribute_email":  section.KeyValue("assertion_attribute_email").MustString(""),
		"assertion_attribute_groups": section.KeyValue("assertion_attribute_groups").MustString(""),
		"assertion_attribute_role":   section.KeyValue("assertion_attribute_role").MustString(""),
		"assertion_attribute_org":    section.KeyValue("assertion_attribute_org").MustString(""),
		"allowed_organizations":      section.KeyValue("allowed_organizations").MustString(""),
		"org_mapping":                section.KeyValue("org_mapping").MustString(""),
		"role_values_none":           section.KeyValue("role_values_none").MustString(""),
		"role_values_viewer":         section.KeyValue("role_values_viewer").MustString(""),
		"role_values_editor":         section.KeyValue("role_values_editor").MustString(""),
		"role_values_admin":          section.KeyValue("role_values_admin").MustString(""),
		"role_values_grafana_admin":  section.KeyValue("role_values_grafana_admin").MustString(""),
		"name_id_format":             section.KeyValue("name_id_format").MustString(""),
		"skip_org_role_sync":         section.KeyValue("skip_org_role_sync").MustBool(false),
		"client_id":                  section.KeyValue("client_id").MustString(""),
		"client_secret":              section.KeyValue("client_secret").MustString(""),
		"token_url":                  section.KeyValue("token_url").MustString(""),
		"force_use_graph_api":        section.KeyValue("force_use_graph_api").MustBool(false),
	}
	return result
}
