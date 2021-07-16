package social

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"net/http"
	"strings"

	"context"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("social")
)

func init() {
	registry.RegisterService(&SocialService{})
}

type SocialService struct {
	Cfg *setting.Cfg `inject:""`

	socialMap     map[string]SocialConnector
	oAuthProvider map[string]*OAuthInfo
}

type OAuthInfo struct {
	ClientId, ClientSecret string
	Scopes                 []string
	AuthUrl, TokenUrl      string
	Enabled                bool
	EmailAttributeName     string
	EmailAttributePath     string
	RoleAttributePath      string
	RoleAttributeStrict    bool
	GroupsAttributePath    string
	AllowedDomains         []string
	HostedDomain           string
	ApiUrl                 string
	AllowSignup            bool
	Name                   string
	TlsClientCert          string
	TlsClientKey           string
	TlsClientCa            string
	TlsSkipVerify          bool
}

func (ss *SocialService) Init() error {
	ss.oAuthProvider = make(map[string]*OAuthInfo)
	ss.socialMap = make(map[string]SocialConnector)

	for _, name := range allOauthes {
		sec := ss.Cfg.Raw.Section("auth." + name)

		info := &OAuthInfo{
			ClientId:            sec.Key("client_id").String(),
			ClientSecret:        sec.Key("client_secret").String(),
			Scopes:              util.SplitString(sec.Key("scopes").String()),
			AuthUrl:             sec.Key("auth_url").String(),
			TokenUrl:            sec.Key("token_url").String(),
			ApiUrl:              sec.Key("api_url").String(),
			Enabled:             sec.Key("enabled").MustBool(),
			EmailAttributeName:  sec.Key("email_attribute_name").String(),
			EmailAttributePath:  sec.Key("email_attribute_path").String(),
			RoleAttributePath:   sec.Key("role_attribute_path").String(),
			RoleAttributeStrict: sec.Key("role_attribute_strict").MustBool(),
			GroupsAttributePath: sec.Key("groups_attribute_path").String(),
			AllowedDomains:      util.SplitString(sec.Key("allowed_domains").String()),
			HostedDomain:        sec.Key("hosted_domain").String(),
			AllowSignup:         sec.Key("allow_sign_up").MustBool(),
			Name:                sec.Key("name").MustString(name),
			TlsClientCert:       sec.Key("tls_client_cert").String(),
			TlsClientKey:        sec.Key("tls_client_key").String(),
			TlsClientCa:         sec.Key("tls_client_ca").String(),
			TlsSkipVerify:       sec.Key("tls_skip_verify_insecure").MustBool(),
		}

		// when empty_scopes parameter exists and is true, overwrite scope with empty value
		if sec.Key("empty_scopes").MustBool() {
			info.Scopes = []string{}
		}

		if !info.Enabled {
			continue
		}

		if name == "grafananet" {
			name = grafanaCom
		}

		ss.oAuthProvider[name] = info

		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:   info.AuthUrl,
				TokenURL:  info.TokenUrl,
				AuthStyle: oauth2.AuthStyleAutoDetect,
			},
			RedirectURL: strings.TrimSuffix(ss.Cfg.AppURL, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		// GitHub.
		if name == "github" {
			ss.socialMap["github"] = &SocialGithub{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		// GitLab.
		if name == "gitlab" {
			ss.socialMap["gitlab"] = &SocialGitlab{
				SocialBase:    newSocialBase(name, &config, info),
				apiUrl:        info.ApiUrl,
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Google.
		if name == "google" {
			ss.socialMap["google"] = &SocialGoogle{
				SocialBase:   newSocialBase(name, &config, info),
				hostedDomain: info.HostedDomain,
				apiUrl:       info.ApiUrl,
			}
		}

		// AzureAD.
		if name == "azuread" {
			ss.socialMap["azuread"] = &SocialAzureAD{
				SocialBase:        newSocialBase(name, &config, info),
				allowedGroups:     util.SplitString(sec.Key("allowed_groups").String()),
				autoAssignOrgRole: ss.Cfg.AutoAssignOrgRole,
			}
		}

		// Okta
		if name == "okta" {
			ss.socialMap["okta"] = &SocialOkta{
				SocialBase:          newSocialBase(name, &config, info),
				apiUrl:              info.ApiUrl,
				allowedGroups:       util.SplitString(sec.Key("allowed_groups").String()),
				roleAttributePath:   info.RoleAttributePath,
				roleAttributeStrict: info.RoleAttributeStrict,
			}
		}

		// Generic - Uses the same scheme as GitHub.
		if name == "generic_oauth" {
			ss.socialMap["generic_oauth"] = &SocialGenericOAuth{
				SocialBase:           newSocialBase(name, &config, info),
				apiUrl:               info.ApiUrl,
				emailAttributeName:   info.EmailAttributeName,
				emailAttributePath:   info.EmailAttributePath,
				nameAttributePath:    sec.Key("name_attribute_path").String(),
				roleAttributePath:    info.RoleAttributePath,
				roleAttributeStrict:  info.RoleAttributeStrict,
				groupsAttributePath:  info.GroupsAttributePath,
				loginAttributePath:   sec.Key("login_attribute_path").String(),
				idTokenAttributeName: sec.Key("id_token_attribute_name").String(),
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		if name == grafanaCom {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:   ss.Cfg.GrafanaComURL + "/oauth2/authorize",
					TokenURL:  ss.Cfg.GrafanaComURL + "/api/oauth2/token",
					AuthStyle: oauth2.AuthStyleInHeader,
				},
				RedirectURL: strings.TrimSuffix(ss.Cfg.AppURL, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			ss.socialMap[grafanaCom] = &SocialGrafanaCom{
				SocialBase:           newSocialBase(name, &config, info),
				url:                  ss.Cfg.GrafanaComURL,
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}
	}
	return nil
}

type BasicUserInfo struct {
	Id      string
	Name    string
	Email   string
	Login   string
	Company string
	Role    string
	Groups  []string
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

func (e Error) Error() string {
	return e.s
}

const (
	grafanaCom = "grafana_com"
)

var (
	SocialBaseUrl = "/login/"
	SocialMap     = make(map[string]SocialConnector)
	allOauthes    = []string{"github", "gitlab", "google", "generic_oauth", "grafananet", grafanaCom, "azuread", "okta"}
)

type Service interface {
	GetOAuthProviders() map[string]bool
	GetOAuthHttpClient(string) (*http.Client, error)
	GetConnector(string) (SocialConnector, error)
	GetOAuthInfoProvider(string) *OAuthInfo
	GetOAuthInfoProviders() map[string]*OAuthInfo
}

func newSocialBase(name string, config *oauth2.Config, info *OAuthInfo) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:         config,
		log:            logger,
		allowSignup:    info.AllowSignup,
		allowedDomains: info.AllowedDomains,
	}
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
func (ss *SocialService) GetOAuthProviders() map[string]bool {
	result := map[string]bool{}

	if ss.Cfg == nil || ss.Cfg.Raw == nil {
		return result
	}

	for _, name := range allOauthes {
		if name == "grafananet" {
			name = grafanaCom
		}

		sec := ss.Cfg.Raw.Section("auth." + name)
		if sec == nil {
			continue
		}
		result[name] = sec.Key("enabled").MustBool()
	}

	return result
}

func (ss *SocialService) GetOAuthHttpClient(name string) (*http.Client, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	name = strings.TrimPrefix(name, "oauth_")
	info, ok := ss.oAuthProvider[name]
	if !ok {
		return nil, fmt.Errorf("could not find %q in OAuth Settings", name)
	}

	// handle call back
	tr := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: info.TlsSkipVerify,
		},
	}
	oauthClient := &http.Client{
		Transport: tr,
	}

	if info.TlsClientCert != "" || info.TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(info.TlsClientCert, info.TlsClientKey)
		if err != nil {
			logger.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCert: %w", err)
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if info.TlsClientCa != "" {
		caCert, err := ioutil.ReadFile(info.TlsClientCa)
		if err != nil {
			logger.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCa: %w", err)
		}
		caCertPool := x509.NewCertPool()
		caCertPool.AppendCertsFromPEM(caCert)
		tr.TLSClientConfig.RootCAs = caCertPool
	}
	return oauthClient, nil
}

func (ss *SocialService) GetConnector(name string) (SocialConnector, error) {
	// The socialMap keys don't have "oauth_" prefix, but everywhere else in the system does
	provider := strings.TrimPrefix(name, "oauth_")
	connector, ok := ss.socialMap[provider]
	if !ok {
		return nil, fmt.Errorf("failed to find oauth provider for %q", name)
	}
	return connector, nil
}

func (ss *SocialService) GetOAuthInfoProvider(name string) *OAuthInfo {
	return ss.oAuthProvider[name]
}

func (ss *SocialService) GetOAuthInfoProviders() map[string]*OAuthInfo {
	return ss.oAuthProvider
}
