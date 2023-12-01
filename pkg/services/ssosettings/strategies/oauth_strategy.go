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

var extraKeysByProvider = map[string][]string{
	"azuread":       social.ExtraAzureADSettingKeys,
	"generic_oauth": social.ExtraGenericOAuthSettingKeys,
	"github":        social.ExtraGithubSettingKeys,
	"grafana_com":   social.ExtraGrafanaComSettingKeys,
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
	section := s.cfg.SectionWithEnvOverrides("auth." + provider)

	result := &social.OAuthInfo{
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

	return result, nil
}
