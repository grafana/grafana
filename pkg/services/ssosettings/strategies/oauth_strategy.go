package strategies

import (
	"context"

	"github.com/grafana/grafana/pkg/login/social/connectors"
	"github.com/grafana/grafana/pkg/login/social/models"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type OAuthStrategy struct {
	cfg                *setting.Cfg
	settingsByProvider map[string]*models.OAuthInfo
}

var extraKeysByProvider = map[string][]string{
	connectors.AzureADProviderName:      connectors.ExtraAzureADSettingKeys,
	connectors.GenericOAuthProviderName: connectors.ExtraGenericOAuthSettingKeys,
	connectors.GitHubProviderName:       connectors.ExtraGithubSettingKeys,
	connectors.GrafanaComProviderName:   connectors.ExtraGrafanaComSettingKeys,
	connectors.GrafanaNetProviderName:   connectors.ExtraGrafanaComSettingKeys,
}

var _ ssosettings.FallbackStrategy = (*OAuthStrategy)(nil)

func NewOAuthStrategy(cfg *setting.Cfg) *OAuthStrategy {
	oauthStrategy := &OAuthStrategy{
		cfg:                cfg,
		settingsByProvider: make(map[string]*models.OAuthInfo),
	}

	oauthStrategy.loadAllSettings()
	return oauthStrategy
}

func (s *OAuthStrategy) IsMatch(provider string) bool {
	_, ok := s.settingsByProvider[provider]
	return ok
}

func (s *OAuthStrategy) GetProviderConfig(_ context.Context, provider string) (any, error) {
	return s.settingsByProvider[provider], nil
}

func (s *OAuthStrategy) loadAllSettings() {
	allProviders := append(ssosettings.AllOAuthProviders, connectors.GrafanaNetProviderName)
	for _, provider := range allProviders {
		settings := s.loadSettingsForProvider(provider)
		if provider == connectors.GrafanaNetProviderName {
			provider = connectors.GrafanaComProviderName
		}
		s.settingsByProvider[provider] = settings
	}
}

func (s *OAuthStrategy) loadSettingsForProvider(provider string) *models.OAuthInfo {
	section := s.cfg.SectionWithEnvOverrides("auth." + provider)

	result := &models.OAuthInfo{
		AllowAssignGrafanaAdmin: section.Key("allow_assign_grafana_admin").MustBool(false),
		AllowSignup:             section.Key("allow_sign_up").MustBool(false),
		AllowedDomains:          util.SplitString(section.Key("allowed_domains").Value()),
		AllowedGroups:           util.SplitString(section.Key("allowed_groups").Value()),
		ApiUrl:                  section.Key("api_url").Value(),
		AuthStyle:               section.Key("auth_style").Value(),
		AuthUrl:                 section.Key("auth_url").Value(),
		AutoLogin:               section.Key("auto_login").MustBool(false),
		ClientId:                section.Key("client_id").Value(),
		ClientSecret:            section.Key("client_secret").Value(),
		EmailAttributeName:      section.Key("email_attribute_name").Value(),
		EmailAttributePath:      section.Key("email_attribute_path").Value(),
		EmptyScopes:             section.Key("empty_scopes").MustBool(false),
		Enabled:                 section.Key("enabled").MustBool(false),
		GroupsAttributePath:     section.Key("groups_attribute_path").Value(),
		HostedDomain:            section.Key("hosted_domain").Value(),
		Icon:                    section.Key("icon").Value(),
		Name:                    section.Key("name").Value(),
		RoleAttributePath:       section.Key("role_attribute_path").Value(),
		RoleAttributeStrict:     section.Key("role_attribute_strict").MustBool(false),
		Scopes:                  util.SplitString(section.Key("scopes").Value()),
		SignoutRedirectUrl:      section.Key("signout_redirect_url").Value(),
		SkipOrgRoleSync:         section.Key("skip_org_role_sync").MustBool(false),
		TeamIdsAttributePath:    section.Key("team_ids_attribute_path").Value(),
		TeamsUrl:                section.Key("teams_url").Value(),
		TlsClientCa:             section.Key("tls_client_ca").Value(),
		TlsClientCert:           section.Key("tls_client_cert").Value(),
		TlsClientKey:            section.Key("tls_client_key").Value(),
		TlsSkipVerify:           section.Key("tls_skip_verify_insecure").MustBool(false),
		TokenUrl:                section.Key("token_url").Value(),
		UsePKCE:                 section.Key("use_pkce").MustBool(false),
		UseRefreshToken:         section.Key("use_refresh_token").MustBool(false),
		Extra:                   map[string]string{},
	}

	extraFields := extraKeysByProvider[provider]
	for _, key := range extraFields {
		result.Extra[key] = section.Key(key).Value()
	}

	return result
}
