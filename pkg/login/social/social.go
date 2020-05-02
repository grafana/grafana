package social

import (
	"io/ioutil"
	"net/http"
	"strings"

	"context"

	"github.com/BurntSushi/toml"
	"golang.org/x/oauth2"
	"golang.org/x/xerrors"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

type BasicUserInfo struct {
	Id            string
	Name          string
	Email         string
	Login         string
	Company       string
	Role          string
	GroupMappings []setting.OAuthGroupMapping
	Groups        []string
}

type SocialConnector interface {
	Type() int
	UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
	TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource
}

type SocialBase struct {
	*oauth2.Config
	log            log.Logger
	allowSignup    bool
	allowedDomains []string
}

type Error struct {
	s string
}

func (e *Error) Error() string {
	return e.s
}

const (
	grafanaCom = "grafana_com"
)

var (
	oauthLogger   = log.New("oauth")
	SocialBaseUrl = "/login/"
	SocialMap     = make(map[string]SocialConnector)
	allOauthes    = []string{"github", "gitlab", "google", "generic_oauth", "grafananet", grafanaCom, "azuread", "okta"}
)

func newSocialBase(name string, config *oauth2.Config, info *setting.OAuthInfo) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:         config,
		log:            logger,
		allowSignup:    info.AllowSignup,
		allowedDomains: info.AllowedDomains,
	}
}

func NewOAuthService() {
	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	for _, name := range allOauthes {
		sec := setting.Raw.Section("auth." + name)
		info := &setting.OAuthInfo{
			ClientId:           sec.Key("client_id").String(),
			ClientSecret:       sec.Key("client_secret").String(),
			Scopes:             util.SplitString(sec.Key("scopes").String()),
			AuthUrl:            sec.Key("auth_url").String(),
			TokenUrl:           sec.Key("token_url").String(),
			ApiUrl:             sec.Key("api_url").String(),
			Enabled:            sec.Key("enabled").MustBool(),
			EmailAttributeName: sec.Key("email_attribute_name").String(),
			EmailAttributePath: sec.Key("email_attribute_path").String(),
			RoleAttributePath:  sec.Key("role_attribute_path").String(),
			AllowedDomains:     util.SplitString(sec.Key("allowed_domains").String()),
			HostedDomain:       sec.Key("hosted_domain").String(),
			AllowSignup:        sec.Key("allow_sign_up").MustBool(),
			Name:               sec.Key("name").MustString(name),
			TlsClientCert:      sec.Key("tls_client_cert").String(),
			TlsClientKey:       sec.Key("tls_client_key").String(),
			TlsClientCa:        sec.Key("tls_client_ca").String(),
			TlsSkipVerify:      sec.Key("tls_skip_verify_insecure").MustBool(),
			GroupMappingsFile:  sec.Key("group_mappings_file").String(),
		}

		if !info.Enabled {
			continue
		}

		groupMappingsConfig, err := readConfig(info.GroupMappingsFile)
		if err != nil {
			log.Error(3, "Error reading group mappings config: %s", err.Error())
		} else {
			info.GroupMappings = groupMappingsConfig.GroupMappings
		}

		if name == "grafananet" {
			name = grafanaCom
		}

		setting.OAuthService.OAuthInfos[name] = info

		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:   info.AuthUrl,
				TokenURL:  info.TokenUrl,
				AuthStyle: oauth2.AuthStyleAutoDetect,
			},
			RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		// GitHub.
		if name == "github" {
			SocialMap["github"] = &SocialGithub{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		// GitLab.
		if name == "gitlab" {
			SocialMap["gitlab"] = &SocialGitlab{
				SocialBase:    newSocialBase(name, &config, info),
				apiUrl:        info.ApiUrl,
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Google.
		if name == "google" {
			SocialMap["google"] = &SocialGoogle{
				SocialBase:   newSocialBase(name, &config, info),
				hostedDomain: info.HostedDomain,
				apiUrl:       info.ApiUrl,
			}
		}

		// AzureAD.
		if name == "azuread" {
			SocialMap["azuread"] = &SocialAzureAD{
				SocialBase:    newSocialBase(name, &config, info),
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Okta
		if name == "okta" {
			SocialMap["okta"] = &SocialOkta{
				SocialBase:        newSocialBase(name, &config, info),
				apiUrl:            info.ApiUrl,
				allowedGroups:     util.SplitString(sec.Key("allowed_groups").String()),
				roleAttributePath: info.RoleAttributePath,
			}
		}

		// Generic - Uses the same scheme as Github.
		if name == "generic_oauth" {
			SocialMap["generic_oauth"] = &SocialGenericOAuth{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				emailAttributeName:   info.EmailAttributeName,
				emailAttributePath:   info.EmailAttributePath,
				roleAttributePath:    info.RoleAttributePath,
				groupMappings:        info.GroupMappings,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		if name == grafanaCom {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:   setting.GrafanaComUrl + "/oauth2/authorize",
					TokenURL:  setting.GrafanaComUrl + "/api/oauth2/token",
					AuthStyle: oauth2.AuthStyleInHeader,
				},
				RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			SocialMap[grafanaCom] = &SocialGrafanaCom{
				SocialBase:           newSocialBase(name, &config, info),
				url:                  setting.GrafanaComUrl,
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}
	}
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
var GetOAuthProviders = func(cfg *setting.Cfg) map[string]bool {
	result := map[string]bool{}

	if cfg == nil || cfg.Raw == nil {
		return result
	}

	for _, name := range allOauthes {
		if name == "grafananet" {
			name = grafanaCom
		}

		sec := cfg.Raw.Section("auth." + name)
		if sec == nil {
			continue
		}
		result[name] = sec.Key("enabled").MustBool()
	}

	return result
}

func readConfig(configFile string) (*setting.OAuthGroupMappingsConfig, error) {
	if configFile == "" {
		return nil, nil
	}
	result := &setting.OAuthGroupMappingsConfig{}

	oauthLogger.Info("OAuth enabled, reading config file", "file", configFile)

	fileBytes, err := ioutil.ReadFile(configFile)
	if err != nil {
		return nil, errutil.Wrap("Failed to load OAuth config file", err)
	}

	_, err = toml.Decode(string(fileBytes), result)
	if err != nil {
		return nil, errutil.Wrap("Failed to load OAuth config file", err)
	}

	if len(result.GroupMappings) == 0 {
		return nil, xerrors.New("OAuth enabled but no group mappings defined in config file")
	}

	// Validate role_attribute_path is set
	for _, groupMapping := range result.GroupMappings {
		if groupMapping.RoleAttributePath == "" {
			return nil, xerrors.New("Failed to validate role_attribute_path setting")
		}
	}

	return result, nil
}
