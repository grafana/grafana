package social

import (
	"net/http"
	"strings"

	"golang.org/x/net/context"
	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/setting"
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
	UserInfo(client *http.Client) (*BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
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

	allOauthes := []string{"github", "google", "generic_oauth", "grafananet"}

	for _, name := range allOauthes {
		sec := setting.Cfg.Section("auth." + name)
		info := &setting.OAuthInfo{
			ClientId:       sec.Key("client_id").String(),
			ClientSecret:   sec.Key("client_secret").String(),
			Scopes:         sec.Key("scopes").Strings(" "),
			AuthUrl:        sec.Key("auth_url").String(),
			TokenUrl:       sec.Key("token_url").String(),
			ApiUrl:         sec.Key("api_url").String(),
			Enabled:        sec.Key("enabled").MustBool(),
			AllowedDomains: sec.Key("allowed_domains").Strings(" "),
			HostedDomain:   sec.Key("hosted_domain").String(),
			AllowSignup:    sec.Key("allow_sign_up").MustBool(),
			Name:           sec.Key("name").MustString(name),
			TlsClientCert:  sec.Key("tls_client_cert").String(),
			TlsClientKey:   sec.Key("tls_client_key").String(),
			TlsClientCa:    sec.Key("tls_client_ca").String(),
		}

		if !info.Enabled {
			continue
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

		// GitHub.
		if name == "github" {
			SocialMap["github"] = &SocialGithub{
				Config:               &config,
				allowedDomains:       info.AllowedDomains,
				apiUrl:               info.ApiUrl,
				allowSignup:          info.AllowSignup,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: sec.Key("allowed_organizations").Strings(" "),
			}
		}

		// Google.
		if name == "google" {
			SocialMap["google"] = &SocialGoogle{
				Config:         &config,
				allowedDomains: info.AllowedDomains,
				hostedDomain:   info.HostedDomain,
				apiUrl:         info.ApiUrl,
				allowSignup:    info.AllowSignup,
			}
		}

		// Generic - Uses the same scheme as Github.
		if name == "generic_oauth" {
			SocialMap["generic_oauth"] = &GenericOAuth{
				Config:               &config,
				allowedDomains:       info.AllowedDomains,
				apiUrl:               info.ApiUrl,
				allowSignup:          info.AllowSignup,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: sec.Key("allowed_organizations").Strings(" "),
			}
		}

		if name == "grafananet" {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:  setting.GrafanaNetUrl + "/oauth2/authorize",
					TokenURL: setting.GrafanaNetUrl + "/api/oauth2/token",
				},
				RedirectURL: strings.TrimSuffix(setting.AppUrl, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			SocialMap["grafananet"] = &SocialGrafanaNet{
				Config:               &config,
				url:                  setting.GrafanaNetUrl,
				allowSignup:          info.AllowSignup,
				allowedOrganizations: sec.Key("allowed_organizations").Strings(" "),
			}
		}
	}
}
