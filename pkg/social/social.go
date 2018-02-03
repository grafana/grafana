package social

import (
	"net/http"
	"strings"

	"context"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type BasicUserInfo struct {
	Name    string
	Email   string
	Login   string
	Company string
	Role    string
}

type SocialConnector interface {
	Type() int
	UserInfo(client *http.Client, token *oauth2.Token) (*BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
}

type SocialBase struct {
	*oauth2.Config
	log log.Logger
}

type Error struct {
	s string
}

func (e *Error) Error() string {
	return e.s
}

var (
	SocialBaseUrl = "/login/"
	SocialMap     = make(map[string]SocialConnector)
)

func NewOAuthService() {
	setting.OAuthService = &setting.OAuther{}
	setting.OAuthService.OAuthInfos = make(map[string]*setting.OAuthInfo)

	allOauthes := []string{"github", "google", "generic_oauth", "grafananet", "grafana_com"}

	for _, name := range allOauthes {
		sec := setting.Cfg.Section("auth." + name)
		info := &setting.OAuthInfo{
			ClientId:       sec.Key("client_id").String(),
			ClientSecret:   sec.Key("client_secret").String(),
			Scopes:         util.SplitString(sec.Key("scopes").String()),
			AuthUrl:        sec.Key("auth_url").String(),
			TokenUrl:       sec.Key("token_url").String(),
			ApiUrl:         sec.Key("api_url").String(),
			Enabled:        sec.Key("enabled").MustBool(),
			AllowedDomains: util.SplitString(sec.Key("allowed_domains").String()),
			HostedDomain:   sec.Key("hosted_domain").String(),
			AllowSignup:    sec.Key("allow_sign_up").MustBool(),
			Name:           sec.Key("name").MustString(name),
			TlsClientCert:  sec.Key("tls_client_cert").String(),
			TlsClientKey:   sec.Key("tls_client_key").String(),
			TlsClientCa:    sec.Key("tls_client_ca").String(),
			TlsSkipVerify:  sec.Key("tls_skip_verify_insecure").MustBool(),
		}

		if !info.Enabled {
			continue
		}

		if name == "grafananet" {
			name = "grafana_com"
		}

		setting.OAuthService.OAuthInfos[name] = info

		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:  info.AuthUrl,
				TokenURL: info.TokenUrl,
			},
			RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		logger := log.New("oauth." + name)

		// GitHub.
		if name == "github" {
			SocialMap["github"] = &SocialGithub{
				SocialBase: &SocialBase{
					Config: &config,
					log:    logger,
				},
				allowedDomains:       info.AllowedDomains,
				apiUrl:               info.ApiUrl,
				allowSignup:          info.AllowSignup,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		// Google.
		if name == "google" {
			SocialMap["google"] = &SocialGoogle{
				SocialBase: &SocialBase{
					Config: &config,
					log:    logger,
				},
				allowedDomains: info.AllowedDomains,
				hostedDomain:   info.HostedDomain,
				apiUrl:         info.ApiUrl,
				allowSignup:    info.AllowSignup,
			}
		}

		// Generic - Uses the same scheme as Github.
		if name == "generic_oauth" {
			SocialMap["generic_oauth"] = &SocialGenericOAuth{
				SocialBase: &SocialBase{
					Config: &config,
					log:    logger,
				},
				allowedDomains:       info.AllowedDomains,
				apiUrl:               info.ApiUrl,
				allowSignup:          info.AllowSignup,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		if name == "grafana_com" {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:  setting.GrafanaComUrl + "/oauth2/authorize",
					TokenURL: setting.GrafanaComUrl + "/api/oauth2/token",
				},
				RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			SocialMap["grafana_com"] = &SocialGrafanaCom{
				SocialBase: &SocialBase{
					Config: &config,
					log:    logger,
				},
				url:                  setting.GrafanaComUrl,
				allowSignup:          info.AllowSignup,
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}
	}
}
