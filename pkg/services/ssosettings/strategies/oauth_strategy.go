package strategies

import (
	"context"
	"regexp"
	"strings"

	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/setting"
)

type OAuthStrategy struct {
	provider                string
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

func (s *OAuthStrategy) ParseConfigFromSystem(_ context.Context) (map[string]interface{}, error) {
	section := s.cfg.SectionWithEnvOverrides("auth." + s.provider)

	result := map[string]interface{}{
		"client_id":                  section.Key("client_id").Value(),
		"client_secret":              section.Key("client_secret").Value(),
		"scopes":                     section.Key("scopes").Value(),
		"auth_url":                   section.Key("auth_url").Value(),
		"token_url":                  section.Key("token_url").Value(),
		"api_url":                    section.Key("api_url").Value(),
		"teams_url":                  section.Key("teams_url").Value(),
		"enabled":                    section.Key("enabled").MustBool(false),
		"email_attribute_name":       section.Key("email_attribute_name").Value(),
		"email_attribute_path":       section.Key("email_attribute_path").Value(),
		"role_attribute_path":        section.Key("role_attribute_path").Value(),
		"role_attribute_strict":      section.Key("role_attribute_strict").MustBool(false),
		"groups_attribute_path":      section.Key("groups_attribute_path").Value(),
		"team_ids_attribute_path":    section.Key("team_ids_attribute_path").Value(),
		"allowed_domains":            section.Key("allowed_domains").Value(),
		"hosted_domain":              section.Key("hosted_domain").Value(),
		"allow_sign_up":              section.Key("allow_sign_up").MustBool(true),
		"name":                       section.Key("name").MustString("default name"), // TODO: change this default value
		"icon":                       section.Key("icon").Value(),
		"tls_client_cert":            section.Key("tls_client_cert").Value(),
		"tls_client_key":             section.Key("tls_client_key").Value(),
		"tls_client_ca":              section.Key("tls_client_ca").Value(),
		"tls_skip_verify_insecure":   section.Key("tls_skip_verify_insecure").MustBool(false),
		"use_pkce":                   section.Key("use_pkce").MustBool(true),
		"use_refresh_token":          section.Key("use_refresh_token").MustBool(false),
		"allow_assign_grafana_admin": section.Key("allow_assign_grafana_admin").MustBool(false),
		"auto_login":                 section.Key("auto_login").MustBool(false),
		"allowed_groups":             section.Key("allowed_groups").Value(),
	}

	// when empty_scopes parameter exists and is true, overwrite scope with empty value
	if section.Key("empty_scopes").MustBool(false) {
		result["scopes"] = []string{}
	}
	return result, nil
}
