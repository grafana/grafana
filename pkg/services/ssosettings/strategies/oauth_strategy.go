package strategies

import (
	"context"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"gopkg.in/ini.v1"
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

	defaultSettings := s.cfg.Defaults.Section(sectionName)

	result := &social.OAuthInfo{
		AllowAssignGrafanaAdmin: social.MustBool(parseDataFromKey("allow_assign_grafana_admin", section, defaultSettings), false),
		AllowSignup:             social.MustBool(parseDataFromKey("allow_sign_up", section, defaultSettings), false),
		AllowedDomains:          util.SplitString(parseDataFromKey("allowed_domains", section, defaultSettings)),
		AllowedGroups:           util.SplitString(parseDataFromKey("allowed_groups", section, defaultSettings)),
		ApiUrl:                  parseDataFromKey("api_url", section, defaultSettings),
		AuthStyle:               parseDataFromKey("auth_style", section, defaultSettings),
		AuthUrl:                 parseDataFromKey("auth_url", section, defaultSettings),
		AutoLogin:               social.MustBool(parseDataFromKey("auto_login", section, defaultSettings), false),
		ClientId:                parseDataFromKey("client_id", section, defaultSettings),
		ClientSecret:            parseDataFromKey("client_secret", section, defaultSettings),
		EmailAttributeName:      parseDataFromKey("email_attribute_name", section, defaultSettings),
		EmailAttributePath:      parseDataFromKey("email_attribute_path", section, defaultSettings),
		EmptyScopes:             social.MustBool(parseDataFromKey("empty_scopes", section, defaultSettings), false),
		Enabled:                 social.MustBool(parseDataFromKey("enabled", section, defaultSettings), false),
		GroupsAttributePath:     parseDataFromKey("groups_attribute_path", section, defaultSettings),
		HostedDomain:            parseDataFromKey("hosted_domain", section, defaultSettings),
		Icon:                    parseDataFromKey("icon", section, defaultSettings),
		Name:                    parseDataFromKey("name", section, defaultSettings),
		RoleAttributePath:       parseDataFromKey("role_attribute_path", section, defaultSettings),
		RoleAttributeStrict:     social.MustBool(parseDataFromKey("role_attribute_strict", section, defaultSettings), false),
		Scopes:                  util.SplitString(parseDataFromKey("scopes", section, defaultSettings)),
		SignoutRedirectUrl:      parseDataFromKey("signout_redirect_url", section, defaultSettings),
		SkipOrgRoleSync:         social.MustBool(parseDataFromKey("skip_org_role_sync", section, defaultSettings), false),
		TeamIdsAttributePath:    parseDataFromKey("team_ids_attribute_path", section, defaultSettings),
		TeamsUrl:                parseDataFromKey("teams_url", section, defaultSettings),
		TlsClientCa:             parseDataFromKey("tls_client_ca", section, defaultSettings),
		TlsClientCert:           parseDataFromKey("tls_client_cert", section, defaultSettings),
		TlsClientKey:            parseDataFromKey("tls_client_key", section, defaultSettings),
		TlsSkipVerify:           social.MustBool(parseDataFromKey("tls_skip_verify_insecure", section, defaultSettings), false),
		TokenUrl:                parseDataFromKey("token_url", section, defaultSettings),
		UsePKCE:                 social.MustBool(parseDataFromKey("use_pkce", section, defaultSettings), false),
		UseRefreshToken:         social.MustBool(parseDataFromKey("use_refresh_token", section, defaultSettings), false),
		Extra:                   map[string]string{},
	}

	extraFields := getExtraKeysForProvider(provider)
	for _, key := range extraFields {
		result.Extra[key] = parseDataFromKey(key, section, defaultSettings)
	}

	return result, nil
}

func parseDataFromKey(key string, section *setting.DynamicSection, defaultSettings *ini.Section) string {
	return util.StringsFallback2(section.Key(key).Value(), defaultSettings.Key(key).Value())
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
