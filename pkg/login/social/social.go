package social

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"

	"context"

	"golang.org/x/oauth2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

var (
	logger = log.New("social")
)

type SocialService struct {
	cfg *setting.Cfg

	socialMap     map[string]SocialConnector
	oAuthProvider map[string]*OAuthInfo
}

type OAuthInfo struct {
	ClientId, ClientSecret  string
	Scopes                  []string
	AuthUrl, TokenUrl       string
	Enabled                 bool
	EmailAttributeName      string
	EmailAttributePath      string
	RoleAttributePath       string
	RoleAttributeStrict     bool
	GroupsAttributePath     string
	TeamIdsAttributePath    string
	AllowedDomains          []string
	AllowAssignGrafanaAdmin bool
	HostedDomain            string
	ApiUrl                  string
	TeamsUrl                string
	AllowSignup             bool
	Name                    string
	Icon                    string
	TlsClientCert           string
	TlsClientKey            string
	TlsClientCa             string
	TlsSkipVerify           bool
	UsePKCE                 bool
}

func ProvideService(cfg *setting.Cfg) *SocialService {
	ss := SocialService{
		cfg:           cfg,
		oAuthProvider: make(map[string]*OAuthInfo),
		socialMap:     make(map[string]SocialConnector),
	}

	for _, name := range allOauthes {
		sec := cfg.Raw.Section("auth." + name)

		info := &OAuthInfo{
			ClientId:                sec.Key("client_id").String(),
			ClientSecret:            sec.Key("client_secret").String(),
			Scopes:                  util.SplitString(sec.Key("scopes").String()),
			AuthUrl:                 sec.Key("auth_url").String(),
			TokenUrl:                sec.Key("token_url").String(),
			ApiUrl:                  sec.Key("api_url").String(),
			TeamsUrl:                sec.Key("teams_url").String(),
			Enabled:                 sec.Key("enabled").MustBool(),
			EmailAttributeName:      sec.Key("email_attribute_name").String(),
			EmailAttributePath:      sec.Key("email_attribute_path").String(),
			RoleAttributePath:       sec.Key("role_attribute_path").String(),
			RoleAttributeStrict:     sec.Key("role_attribute_strict").MustBool(),
			GroupsAttributePath:     sec.Key("groups_attribute_path").String(),
			TeamIdsAttributePath:    sec.Key("team_ids_attribute_path").String(),
			AllowedDomains:          util.SplitString(sec.Key("allowed_domains").String()),
			HostedDomain:            sec.Key("hosted_domain").String(),
			AllowSignup:             sec.Key("allow_sign_up").MustBool(),
			Name:                    sec.Key("name").MustString(name),
			Icon:                    sec.Key("icon").String(),
			TlsClientCert:           sec.Key("tls_client_cert").String(),
			TlsClientKey:            sec.Key("tls_client_key").String(),
			TlsClientCa:             sec.Key("tls_client_ca").String(),
			TlsSkipVerify:           sec.Key("tls_skip_verify_insecure").MustBool(),
			UsePKCE:                 sec.Key("use_pkce").MustBool(),
			AllowAssignGrafanaAdmin: sec.Key("allow_assign_grafana_admin").MustBool(false),
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

		var authStyle oauth2.AuthStyle
		switch strings.ToLower(sec.Key("auth_style").String()) {
		case "inparams":
			authStyle = oauth2.AuthStyleInParams
		case "inheader":
			authStyle = oauth2.AuthStyleInHeader
		case "autodetect", "":
			authStyle = oauth2.AuthStyleAutoDetect
		default:
			logger.Warn("Invalid auth style specified, defaulting to auth style AutoDetect", "auth_style", sec.Key("auth_style").String())
			authStyle = oauth2.AuthStyleAutoDetect
		}

		config := oauth2.Config{
			ClientID:     info.ClientId,
			ClientSecret: info.ClientSecret,
			Endpoint: oauth2.Endpoint{
				AuthURL:   info.AuthUrl,
				TokenURL:  info.TokenUrl,
				AuthStyle: authStyle,
			},
			RedirectURL: strings.TrimSuffix(cfg.AppURL, "/") + SocialBaseUrl + name,
			Scopes:      info.Scopes,
		}

		// GitHub.
		if name == "github" {
			ss.socialMap["github"] = &SocialGithub{
				SocialBase:           newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				apiUrl:               info.ApiUrl,
				teamIds:              sec.Key("team_ids").Ints(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		// GitLab.
		if name == "gitlab" {
			ss.socialMap["gitlab"] = &SocialGitlab{
				SocialBase:    newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				apiUrl:        info.ApiUrl,
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Google.
		if name == "google" {
			ss.socialMap["google"] = &SocialGoogle{
				SocialBase:   newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				hostedDomain: info.HostedDomain,
				apiUrl:       info.ApiUrl,
			}
		}

		// AzureAD.
		if name == "azuread" {
			ss.socialMap["azuread"] = &SocialAzureAD{
				SocialBase:    newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Okta
		if name == "okta" {
			ss.socialMap["okta"] = &SocialOkta{
				SocialBase:    newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				apiUrl:        info.ApiUrl,
				allowedGroups: util.SplitString(sec.Key("allowed_groups").String()),
			}
		}

		// Generic - Uses the same scheme as GitHub.
		if name == "generic_oauth" {
			ss.socialMap["generic_oauth"] = &SocialGenericOAuth{
				SocialBase:           newSocialBase(name, &config, info, cfg.AutoAssignOrgRole),
				apiUrl:               info.ApiUrl,
				teamsUrl:             info.TeamsUrl,
				emailAttributeName:   info.EmailAttributeName,
				emailAttributePath:   info.EmailAttributePath,
				nameAttributePath:    sec.Key("name_attribute_path").String(),
				groupsAttributePath:  info.GroupsAttributePath,
				loginAttributePath:   sec.Key("login_attribute_path").String(),
				idTokenAttributeName: sec.Key("id_token_attribute_name").String(),
				teamIdsAttributePath: sec.Key("team_ids_attribute_path").String(),
				teamIds:              sec.Key("team_ids").Strings(","),
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}

		if name == grafanaCom {
			config = oauth2.Config{
				ClientID:     info.ClientId,
				ClientSecret: info.ClientSecret,
				Endpoint: oauth2.Endpoint{
					AuthURL:   cfg.GrafanaComURL + "/oauth2/authorize",
					TokenURL:  cfg.GrafanaComURL + "/api/oauth2/token",
					AuthStyle: oauth2.AuthStyleInHeader,
				},
				RedirectURL: strings.TrimSuffix(cfg.AppURL, "/") + SocialBaseUrl + name,
				Scopes:      info.Scopes,
			}

			ss.socialMap[grafanaCom] = &SocialGrafanaCom{
				SocialBase: newSocialBase(name, &config, info,
					cfg.AutoAssignOrgRole),
				url:                  cfg.GrafanaComURL,
				allowedOrganizations: util.SplitString(sec.Key("allowed_organizations").String()),
			}
		}
	}
	return &ss
}

type BasicUserInfo struct {
	Id             string
	Name           string
	Email          string
	Login          string
	Role           string
	IsGrafanaAdmin *bool // nil will avoid overriding user's set server admin setting
	Groups         []string
}

func (b *BasicUserInfo) String() string {
	return fmt.Sprintf("Id: %s, Name: %s, Email: %s, Login: %s, Role: %s, Groups: %v",
		b.Id, b.Name, b.Email, b.Login, b.Role, b.Groups)
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
	log                     log.Logger
	allowSignup             bool
	allowAssignGrafanaAdmin bool
	allowedDomains          []string

	roleAttributePath   string
	roleAttributeStrict bool
	autoAssignOrgRole   string
}

type Error struct {
	s string
}

func (e Error) Error() string {
	return e.s
}

const (
	grafanaCom       = "grafana_com"
	RoleGrafanaAdmin = "GrafanaAdmin" // For AzureAD for example this value cannot contain spaces
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

func newSocialBase(name string,
	config *oauth2.Config,
	info *OAuthInfo,
	autoAssignOrgRole string,
) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:                  config,
		log:                     logger,
		allowSignup:             info.AllowSignup,
		allowAssignGrafanaAdmin: info.AllowAssignGrafanaAdmin,
		allowedDomains:          info.AllowedDomains,
		autoAssignOrgRole:       autoAssignOrgRole,
		roleAttributePath:       info.RoleAttributePath,
		roleAttributeStrict:     info.RoleAttributeStrict,
	}
}

type groupStruct struct {
	Groups []string `json:"groups"`
}

func (s *SocialBase) extractRoleAndAdmin(rawJSON []byte, groups []string) (org.RoleType, bool) {
	if s.roleAttributePath == "" {
		if s.autoAssignOrgRole != "" {
			return org.RoleType(s.autoAssignOrgRole), false
		}

		return "", false
	}

	role, err := s.searchJSONForStringAttr(s.roleAttributePath, rawJSON)
	if err == nil && role != "" {
		return getRoleFromSearch(role)
	}

	if groupBytes, err := json.Marshal(groupStruct{groups}); err == nil {
		role, err := s.searchJSONForStringAttr(s.roleAttributePath, groupBytes)
		if err == nil && role != "" {
			return getRoleFromSearch(role)
		}
	}

	return "", false
}

// match grafana admin role and translate to org role and bool.
// treat the JSON search result to ensure correct casing.
func getRoleFromSearch(role string) (org.RoleType, bool) {
	if strings.EqualFold(role, RoleGrafanaAdmin) {
		return org.RoleAdmin, true
	}

	return org.RoleType(cases.Title(language.Und).String(role)), false
}

// GetOAuthProviders returns available oauth providers and if they're enabled or not
func (ss *SocialService) GetOAuthProviders() map[string]bool {
	result := map[string]bool{}

	if ss.cfg == nil || ss.cfg.Raw == nil {
		return result
	}

	for _, name := range allOauthes {
		if name == "grafananet" {
			name = grafanaCom
		}

		sec := ss.cfg.Raw.Section("auth." + name)
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
		caCert, err := os.ReadFile(info.TlsClientCa)
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
