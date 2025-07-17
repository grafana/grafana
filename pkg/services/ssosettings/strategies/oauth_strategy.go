package strategies

import (
	"context"
	"maps"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type OAuthStrategy struct {
	cfg                *setting.Cfg
	settingsByProvider map[string]map[string]any
}

var extraKeysByProvider = map[string]map[string]connectors.ExtraKeyInfo{
	social.AzureADProviderName:      connectors.ExtraAzureADSettingKeys,
	social.GenericOAuthProviderName: connectors.ExtraGenericOAuthSettingKeys,
	social.GitHubProviderName:       connectors.ExtraGithubSettingKeys,
	social.GoogleProviderName:       connectors.ExtraGoogleSettingKeys,
	social.GrafanaComProviderName:   connectors.ExtraGrafanaComSettingKeys,
	social.GrafanaNetProviderName:   connectors.ExtraGrafanaComSettingKeys,
}

var _ ssosettings.FallbackStrategy = (*OAuthStrategy)(nil)

func NewOAuthStrategy(cfg *setting.Cfg) *OAuthStrategy {
	oauthStrategy := &OAuthStrategy{
		cfg:                cfg,
		settingsByProvider: make(map[string]map[string]any),
	}

	oauthStrategy.loadAllSettings()
	return oauthStrategy
}

func (s *OAuthStrategy) IsMatch(provider string) bool {
	_, ok := s.settingsByProvider[provider]
	return ok
}

func (s *OAuthStrategy) GetProviderConfig(_ context.Context, provider string) (map[string]any, error) {
	providerConfig := s.settingsByProvider[provider]
	result := make(map[string]any, len(providerConfig))
	maps.Copy(result, providerConfig)
	return result, nil
}

func (s *OAuthStrategy) loadAllSettings() {
	allProviders := append(ssosettings.AllOAuthProviders, social.GrafanaNetProviderName)
	for _, provider := range allProviders {
		settings := s.loadSettingsForProvider(provider)
		// This is required to support the legacy settings for the provider (auth.grafananet section)
		// It will use the settings (and overwrite the current grafana_com settings) from auth.grafananet if
		// the auth.grafananet section is enabled and the auth.grafana_com section is disabled.
		if provider == social.GrafanaNetProviderName && s.shouldUseGrafanaNetSettings() && settings["enabled"] == true {
			provider = social.GrafanaComProviderName
		}
		s.settingsByProvider[provider] = settings
	}
}

func (s *OAuthStrategy) shouldUseGrafanaNetSettings() bool {
	return s.settingsByProvider[social.GrafanaComProviderName]["enabled"] == false
}

func (s *OAuthStrategy) loadSettingsForProvider(provider string) map[string]any {
	section := s.cfg.Raw.Section("auth." + provider)

	result := map[string]any{
		"client_authentication":         section.Key("client_authentication").Value(),
		"client_id":                     section.Key("client_id").Value(),
		"client_secret":                 section.Key("client_secret").Value(),
		"managed_identity_client_id":    section.Key("managed_identity_client_id").Value(),
		"federated_credential_audience": section.Key("federated_credential_audience").Value(),
		"workload_identity_token_file":  section.Key("workload_identity_token_file").Value(),
		"scopes":                        section.Key("scopes").Value(),
		"empty_scopes":                  section.Key("empty_scopes").MustBool(false),
		"auth_style":                    section.Key("auth_style").Value(),
		"auth_url":                      section.Key("auth_url").Value(),
		"token_url":                     section.Key("token_url").Value(),
		"api_url":                       section.Key("api_url").Value(),
		"teams_url":                     section.Key("teams_url").Value(),
		"enabled":                       section.Key("enabled").MustBool(false),
		"email_attribute_name":          section.Key("email_attribute_name").Value(),
		"email_attribute_path":          section.Key("email_attribute_path").Value(),
		"role_attribute_path":           section.Key("role_attribute_path").Value(),
		"role_attribute_strict":         section.Key("role_attribute_strict").MustBool(false),
		"groups_attribute_path":         section.Key("groups_attribute_path").Value(),
		"team_ids_attribute_path":       section.Key("team_ids_attribute_path").Value(),
		"allowed_domains":               section.Key("allowed_domains").Value(),
		"hosted_domain":                 section.Key("hosted_domain").Value(),
		"allow_sign_up":                 section.Key("allow_sign_up").MustBool(false),
		"name":                          section.Key("name").Value(),
		"icon":                          section.Key("icon").Value(),
		"skip_org_role_sync":            section.Key("skip_org_role_sync").MustBool(false),
		"tls_client_cert":               section.Key("tls_client_cert").Value(),
		"tls_client_key":                section.Key("tls_client_key").Value(),
		"tls_client_ca":                 section.Key("tls_client_ca").Value(),
		"tls_skip_verify_insecure":      section.Key("tls_skip_verify_insecure").MustBool(false),
		"use_pkce":                      section.Key("use_pkce").MustBool(false),
		"use_refresh_token":             section.Key("use_refresh_token").MustBool(false),
		"allow_assign_grafana_admin":    section.Key("allow_assign_grafana_admin").MustBool(false),
		"auto_login":                    section.Key("auto_login").MustBool(false),
		"allowed_groups":                section.Key("allowed_groups").Value(),
		"signout_redirect_url":          section.Key("signout_redirect_url").Value(),
		"org_mapping":                   section.Key("org_mapping").Value(),
		"org_attribute_path":            section.Key("org_attribute_path").Value(),
		"login_prompt":                  section.Key("login_prompt").Value(),
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
