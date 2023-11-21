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

func (s *OAuthStrategy) ParseConfigFromSystem(_ context.Context, provider string) (map[string]interface{}, error) {
	section := s.cfg.SectionWithEnvOverrides("auth." + provider)

	defaultSettings := getDefaultOAuthInfoForProvider(provider)

	result := map[string]interface{}{
		"client_id":                  parseDataFromKey("client_id", section, defaultSettings),
		"client_secret":              parseDataFromKey("client_secret", section, defaultSettings),
		"scopes":                     parseDataFromKey("scopes", section, defaultSettings),
		"auth_url":                   parseDataFromKey("auth_url", section, defaultSettings),
		"token_url":                  parseDataFromKey("token_url", section, defaultSettings),
		"api_url":                    parseDataFromKey("api_url", section, defaultSettings),
		"teams_url":                  parseDataFromKey("teams_url", section, defaultSettings),
		"enabled":                    parseDataFromKey("enabled", section, defaultSettings),
		"email_attribute_name":       parseDataFromKey("email_attribute_name", section, defaultSettings),
		"email_attribute_path":       parseDataFromKey("email_attribute_path", section, defaultSettings),
		"role_attribute_path":        parseDataFromKey("role_attribute_path", section, defaultSettings),
		"role_attribute_strict":      parseDataFromKey("role_attribute_strict", section, defaultSettings),
		"groups_attribute_path":      parseDataFromKey("groups_attribute_path", section, defaultSettings),
		"team_ids_attribute_path":    parseDataFromKey("team_ids_attribute_path", section, defaultSettings),
		"allowed_domains":            parseDataFromKey("allowed_domains", section, defaultSettings), // list
		"hosted_domain":              parseDataFromKey("hosted_domain", section, defaultSettings),
		"allow_sign_up":              parseDataFromKey("allow_sign_up", section, defaultSettings),
		"name":                       parseDataFromKey("name", section, defaultSettings),
		"icon":                       parseDataFromKey("icon", section, defaultSettings),
		"tls_client_cert":            parseDataFromKey("tls_client_cert", section, defaultSettings),
		"tls_client_key":             parseDataFromKey("tls_client_key", section, defaultSettings),
		"tls_client_ca":              parseDataFromKey("tls_client_ca", section, defaultSettings),
		"tls_skip_verify_insecure":   parseDataFromKey("tls_skip_verify_insecure", section, defaultSettings),
		"use_pkce":                   parseDataFromKey("use_pkce", section, defaultSettings),
		"use_refresh_token":          parseDataFromKey("use_refresh_token", section, defaultSettings),
		"allow_assign_grafana_admin": parseDataFromKey("allow_assign_grafana_admin", section, defaultSettings),
		"auto_login":                 parseDataFromKey("auto_login", section, defaultSettings),
		"allowed_groups":             parseDataFromKey("allowed_groups", section, defaultSettings),
		// "skip_org_role_sync":         parseDataFromKey("skip_org_role_sync", section, defaultSettings),
	}

	extraFields := getExtraKeysForProvider(provider)
	for _, key := range extraFields {
		result[key] = parseDataFromKey(key, section, defaultSettings)
	}

	// when empty_scopes parameter exists and is true, overwrite scope with empty value
	if section.Key("empty_scopes").MustBool(false) {
		result["scopes"] = ""
	}

	result = ssosettings.ConvertMapSnakeCaseKeysToCamelCaseKeys(result)

	return result, nil
}

func parseDataFromKey(key string, section *setting.DynamicSection, defaultSettings map[string]string) string {
	return util.StringsFallback2(section.Key(key).Value(), defaultSettings[key])
}

func getDefaultOAuthInfoForProvider(provider string) map[string]string {
	switch provider {
	case "azuread":
		return social.AzureADDefaultSettings
	default:
		return map[string]string{}
	}
}

func getExtraKeysForProvider(provider string) []string {
	switch provider {
	case "azuread":
		return social.ExtraAzureADSettingKeys
	default:
		return nil
	}
}
