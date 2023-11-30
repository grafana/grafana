package strategies

import (
	"context"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type OAuthStrategy struct {
	cfg                     *setting.Cfg
	supportedProvidersRegex *regexp.Regexp
}

var _ ssosettings.FallbackStrategy = (*OAuthStrategy)(nil)

func NewOAuthStrategy(cfg *setting.Cfg) *OAuthStrategy {
	compiledRegex := regexp.MustCompile(`^` + strings.Join(ssosettings.AllOAuthProviders, "|") + `$`)
	return &OAuthStrategy{
		cfg:                     cfg,
		supportedProvidersRegex: compiledRegex,
	}
}

func (s *OAuthStrategy) IsMatch(provider string) bool {
	return s.supportedProvidersRegex.MatchString(provider)
}

func (s *OAuthStrategy) ParseConfigFromSystem(_ context.Context, provider string) (any, error) {
	sectionName := "auth." + provider
	section := s.cfg.SectionWithEnvOverrides(sectionName)

	result := &social.OAuthInfo{
		AllowAssignGrafanaAdmin: social.MustBool(section.Key("allow_assign_grafana_admin").Value(), false),
		AllowSignup:             social.MustBool(section.Key("allow_sign_up").Value(), false),
		AllowedDomains:          util.SplitString(section.Key("allowed_domains").Value()),
		AllowedGroups:           util.SplitString(section.Key("allowed_groups").Value()),
		ApiUrl:                  section.Key("api_url").Value(),
		AuthStyle:               section.Key("auth_style").Value(),
		AuthUrl:                 section.Key("auth_url").Value(),
		AutoLogin:               social.MustBool(section.Key("auto_login").Value(), false),
		ClientId:                section.Key("client_id").Value(),
		ClientSecret:            section.Key("client_secret").Value(),
		EmailAttributeName:      section.Key("email_attribute_name").Value(),
		EmailAttributePath:      section.Key("email_attribute_path").Value(),
		EmptyScopes:             social.MustBool(section.Key("empty_scopes").Value(), false),
		Enabled:                 social.MustBool(section.Key("enabled").Value(), false),
		GroupsAttributePath:     section.Key("groups_attribute_path").Value(),
		HostedDomain:            section.Key("hosted_domain").Value(),
		Icon:                    section.Key("icon").Value(),
		Name:                    section.Key("name").Value(),
		RoleAttributePath:       section.Key("role_attribute_path").Value(),
		RoleAttributeStrict:     social.MustBool(section.Key("role_attribute_strict").Value(), false),
		Scopes:                  util.SplitString(section.Key("scopes").Value()),
		SignoutRedirectUrl:      section.Key("signout_redirect_url").Value(),
		SkipOrgRoleSync:         social.MustBool(section.Key("skip_org_role_sync").Value(), false),
		TeamIdsAttributePath:    section.Key("team_ids_attribute_path").Value(),
		TeamsUrl:                section.Key("teams_url").Value(),
		TlsClientCa:             section.Key("tls_client_ca").Value(),
		TlsClientCert:           section.Key("tls_client_cert").Value(),
		TlsClientKey:            section.Key("tls_client_key").Value(),
		TlsSkipVerify:           social.MustBool(section.Key("tls_skip_verify_insecure").Value(), false),
		TokenUrl:                section.Key("token_url").Value(),
		UsePKCE:                 social.MustBool(section.Key("use_pkce").Value(), false),
		UseRefreshToken:         social.MustBool(section.Key("use_refresh_token").Value(), false),
		Extra:                   map[string]string{},
	}

	extraFields := getExtraKeysForProvider(provider)
	for _, key := range extraFields {
		result.Extra[key] = section.Key(key).Value()
	}

	return result, nil
}

func getExtraKeysForProvider(provider string) []string {
	switch provider {
	case "azuread":
		return social.ExtraAzureADSettingKeys
	case "generic_oauth":
		return social.ExtraGenericOAuthSettingKeys
	case "github":
		return social.ExtraGithubSettingKeys
	case "grafana_com":
		return social.ExtraGrafanaComSettingKeys
	default:
		return nil
	}
}
