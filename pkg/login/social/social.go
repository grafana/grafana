package social

import (
	"bytes"
	"compress/zlib"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/supportbundles"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	OfflineAccessScope = "offline_access"
)

type SocialService struct {
	cfg *setting.Cfg

	socialMap     map[string]SocialConnector
	oAuthProvider map[string]*OAuthInfo
	log           log.Logger
}

type OAuthInfo struct {
	ApiUrl                  string            `mapstructure:"api_url"`
	AuthUrl                 string            `mapstructure:"auth_url"`
	AuthStyle               string            `mapstructure:"auth_style"`
	ClientId                string            `mapstructure:"client_id"`
	ClientSecret            string            `mapstructure:"client_secret"`
	EmailAttributeName      string            `mapstructure:"email_attribute_name"`
	EmailAttributePath      string            `mapstructure:"email_attribute_path"`
	EmptyScopes             bool              `mapstructure:"empty_scopes"`
	GroupsAttributePath     string            `mapstructure:"groups_attribute_path"`
	HostedDomain            string            `mapstructure:"hosted_domain"`
	Icon                    string            `mapstructure:"icon"`
	Name                    string            `mapstructure:"name"`
	RoleAttributePath       string            `mapstructure:"role_attribute_path"`
	TeamIdsAttributePath    string            `mapstructure:"team_ids_attribute_path"`
	TeamsUrl                string            `mapstructure:"teams_url"`
	TlsClientCa             string            `mapstructure:"tls_client_ca"`
	TlsClientCert           string            `mapstructure:"tls_client_cert"`
	TlsClientKey            string            `mapstructure:"tls_client_key"`
	TokenUrl                string            `mapstructure:"token_url"`
	AllowedDomains          []string          `mapstructure:"allowed_domains"`
	AllowedGroups           []string          `mapstructure:"allowed_groups"`
	Scopes                  []string          `mapstructure:"scopes"`
	AllowAssignGrafanaAdmin bool              `mapstructure:"allow_assign_grafana_admin"`
	AllowSignup             bool              `mapstructure:"allow_sign_up"`
	AutoLogin               bool              `mapstructure:"auto_login"`
	Enabled                 bool              `mapstructure:"enabled"`
	RoleAttributeStrict     bool              `mapstructure:"role_attribute_strict"`
	TlsSkipVerify           bool              `mapstructure:"tls_skip_verify_insecure"`
	UsePKCE                 bool              `mapstructure:"use_pkce"`
	UseRefreshToken         bool              `mapstructure:"use_refresh_token"`
	Extra                   map[string]string `mapstructure:",remain"`
	SignoutRedirectUrl      string   `toml:"signout_redirect_url"`
}

func ProvideService(cfg *setting.Cfg,
	features *featuremgmt.FeatureManager,
	usageStats usagestats.Service,
	bundleRegistry supportbundles.Service,
	cache remotecache.CacheStorage,
) *SocialService {
	ss := &SocialService{
		cfg:           cfg,
		oAuthProvider: make(map[string]*OAuthInfo),
		socialMap:     make(map[string]SocialConnector),
		log:           log.New("login.social"),
	}

	usageStats.RegisterMetricsFunc(ss.getUsageStats)

	for _, name := range allOauthes {
		sec := cfg.Raw.Section("auth." + name)

		settingsKVs := convertIniSectionToMap(sec)
		info, err := createOAuthInfoFromKeyValues(settingsKVs)
		if err != nil {
			ss.log.Error("Failed to create OAuthInfo for provider", "error", err, "provider", name)
			continue
		}

		if !info.Enabled {
			continue
		}

		if name == "grafananet" {
			name = grafanaCom
		}

		conn, err := ss.createOAuthConnector(name, settingsKVs, cfg, features, cache)
		if err != nil {
			ss.log.Error("Failed to create OAuth provider", "error", err, "provider", name)
		}

		ss.socialMap[name] = conn
		ss.oAuthProvider[name] = ss.socialMap[name].GetOAuthInfo()
	}

	ss.registerSupportBundleCollectors(bundleRegistry)

	return ss
}

type BasicUserInfo struct {
	Id             string
	Name           string
	Email          string
	Login          string
	Role           org.RoleType
	IsGrafanaAdmin *bool // nil will avoid overriding user's set server admin setting
	Groups         []string
}

func (b *BasicUserInfo) String() string {
	return fmt.Sprintf("Id: %s, Name: %s, Email: %s, Login: %s, Role: %s, Groups: %v",
		b.Id, b.Name, b.Email, b.Login, b.Role, b.Groups)
}

//go:generate mockery --name SocialConnector --structname MockSocialConnector --outpkg socialtest --filename social_connector_mock.go --output ../socialtest/
type SocialConnector interface {
	UserInfo(ctx context.Context, client *http.Client, token *oauth2.Token) (*BasicUserInfo, error)
	IsEmailAllowed(email string) bool
	IsSignupAllowed() bool

	GetOAuthInfo() *OAuthInfo

	AuthCodeURL(state string, opts ...oauth2.AuthCodeOption) string
	Exchange(ctx context.Context, code string, authOptions ...oauth2.AuthCodeOption) (*oauth2.Token, error)
	Client(ctx context.Context, t *oauth2.Token) *http.Client
	TokenSource(ctx context.Context, t *oauth2.Token) oauth2.TokenSource
	SupportBundleContent(*bytes.Buffer) error
}

type SocialBase struct {
	*oauth2.Config
	info                    *OAuthInfo
	log                     log.Logger
	allowSignup             bool
	allowAssignGrafanaAdmin bool
	allowedDomains          []string
	allowedGroups           []string

	roleAttributePath   string
	roleAttributeStrict bool
	autoAssignOrgRole   string
	skipOrgRoleSync     bool
	features            featuremgmt.FeatureManager
	useRefreshToken     bool
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
	skipOrgRoleSync bool,
	features featuremgmt.FeatureManager,
) *SocialBase {
	logger := log.New("oauth." + name)

	return &SocialBase{
		Config:                  config,
		info:                    info,
		log:                     logger,
		allowSignup:             info.AllowSignup,
		allowAssignGrafanaAdmin: info.AllowAssignGrafanaAdmin,
		allowedDomains:          info.AllowedDomains,
		allowedGroups:           info.AllowedGroups,
		roleAttributePath:       info.RoleAttributePath,
		roleAttributeStrict:     info.RoleAttributeStrict,
		autoAssignOrgRole:       autoAssignOrgRole,
		skipOrgRoleSync:         skipOrgRoleSync,
		features:                features,
		useRefreshToken:         info.UseRefreshToken,
	}
}

type groupStruct struct {
	Groups []string `json:"groups"`
}

func (s *SocialBase) SupportBundleContent(bf *bytes.Buffer) error {
	bf.WriteString("## Client configuration\n\n")
	bf.WriteString("```ini\n")
	bf.WriteString(fmt.Sprintf("allow_assign_grafana_admin = %v\n", s.allowAssignGrafanaAdmin))
	bf.WriteString(fmt.Sprintf("allow_sign_up = %v\n", s.allowSignup))
	bf.WriteString(fmt.Sprintf("allowed_domains = %v\n", s.allowedDomains))
	bf.WriteString(fmt.Sprintf("auto_assign_org_role = %v\n", s.autoAssignOrgRole))
	bf.WriteString(fmt.Sprintf("role_attribute_path = %v\n", s.roleAttributePath))
	bf.WriteString(fmt.Sprintf("role_attribute_strict = %v\n", s.roleAttributeStrict))
	bf.WriteString(fmt.Sprintf("skip_org_role_sync = %v\n", s.skipOrgRoleSync))
	bf.WriteString(fmt.Sprintf("client_id = %v\n", s.Config.ClientID))
	bf.WriteString(fmt.Sprintf("client_secret = %v ; issue if empty\n", strings.Repeat("*", len(s.Config.ClientSecret))))
	bf.WriteString(fmt.Sprintf("auth_url = %v\n", s.Config.Endpoint.AuthURL))
	bf.WriteString(fmt.Sprintf("token_url = %v\n", s.Config.Endpoint.TokenURL))
	bf.WriteString(fmt.Sprintf("auth_style = %v\n", s.Config.Endpoint.AuthStyle))
	bf.WriteString(fmt.Sprintf("redirect_url = %v\n", s.Config.RedirectURL))
	bf.WriteString(fmt.Sprintf("scopes = %v\n", s.Config.Scopes))
	bf.WriteString("```\n\n")
	return nil
}

func (s *SocialBase) extractRoleAndAdminOptional(rawJSON []byte, groups []string) (org.RoleType, bool, error) {
	if s.roleAttributePath == "" {
		if s.roleAttributeStrict {
			return "", false, errRoleAttributePathNotSet.Errorf("role_attribute_path not set and role_attribute_strict is set")
		}
		return "", false, nil
	}

	if role, gAdmin := s.searchRole(rawJSON, groups); role.IsValid() {
		return role, gAdmin, nil
	} else if role != "" {
		return "", false, errInvalidRole.Errorf("invalid role: %s", role)
	}

	if s.roleAttributeStrict {
		return "", false, errRoleAttributeStrictViolation.Errorf("idP did not return a role attribute, but role_attribute_strict is set")
	}

	return "", false, nil
}

func (s *SocialBase) extractRoleAndAdmin(rawJSON []byte, groups []string) (org.RoleType, bool, error) {
	role, gAdmin, err := s.extractRoleAndAdminOptional(rawJSON, groups)
	if role == "" {
		role = s.defaultRole()
	}

	return role, gAdmin, err
}

func (s *SocialBase) searchRole(rawJSON []byte, groups []string) (org.RoleType, bool) {
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

// defaultRole returns the default role for the user based on the autoAssignOrgRole setting
// if legacy is enabled "" is returned indicating the previous role assignment is used.
func (s *SocialBase) defaultRole() org.RoleType {
	if s.autoAssignOrgRole != "" {
		s.log.Debug("No role found, returning default.")
		return org.RoleType(s.autoAssignOrgRole)
	}

	// should never happen
	return org.RoleViewer
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
		DialContext: (&net.Dialer{
			Timeout:   time.Second * 10,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout:   15 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
	}

	oauthClient := &http.Client{
		Transport: tr,
		Timeout:   time.Second * 15,
	}

	if info.TlsClientCert != "" || info.TlsClientKey != "" {
		cert, err := tls.LoadX509KeyPair(info.TlsClientCert, info.TlsClientKey)
		if err != nil {
			ss.log.Error("Failed to setup TlsClientCert", "oauth", name, "error", err)
			return nil, fmt.Errorf("failed to setup TlsClientCert: %w", err)
		}

		tr.TLSClientConfig.Certificates = append(tr.TLSClientConfig.Certificates, cert)
	}

	if info.TlsClientCa != "" {
		caCert, err := os.ReadFile(info.TlsClientCa)
		if err != nil {
			ss.log.Error("Failed to setup TlsClientCa", "oauth", name, "error", err)
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

func (ss *SocialService) getUsageStats(ctx context.Context) (map[string]any, error) {
	m := map[string]any{}

	authTypes := map[string]bool{}
	for provider, enabled := range ss.GetOAuthProviders() {
		authTypes["oauth_"+provider] = enabled
	}

	for authType, enabled := range authTypes {
		enabledValue := 0
		if enabled {
			enabledValue = 1
		}

		m["stats.auth_enabled."+authType+".count"] = enabledValue
	}

	return m, nil
}

func (s *SocialBase) isGroupMember(groups []string) bool {
	if len(s.allowedGroups) == 0 {
		return true
	}

	for _, allowedGroup := range s.allowedGroups {
		for _, group := range groups {
			if group == allowedGroup {
				return true
			}
		}
	}

	return false
}

func (s *SocialBase) retrieveRawIDToken(idToken any) ([]byte, error) {
	tokenString, ok := idToken.(string)
	if !ok {
		return nil, fmt.Errorf("id_token is not a string: %v", idToken)
	}

	jwtRegexp := regexp.MustCompile("^([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)[.]([-_a-zA-Z0-9=]+)$")
	matched := jwtRegexp.FindStringSubmatch(tokenString)
	if matched == nil {
		return nil, fmt.Errorf("id_token is not in JWT format: %s", tokenString)
	}

	rawJSON, err := base64.RawURLEncoding.DecodeString(matched[2])
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding id_token: %w", err)
	}

	headerBytes, err := base64.RawURLEncoding.DecodeString(matched[1])
	if err != nil {
		return nil, fmt.Errorf("error base64 decoding header: %w", err)
	}

	var header map[string]any
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return nil, fmt.Errorf("error deserializing header: %w", err)
	}

	if compressionVal, exists := header["zip"]; exists {
		compression, ok := compressionVal.(string)
		if !ok {
			return nil, fmt.Errorf("unrecognized compression header: %v", compressionVal)
		}

		if compression != "DEF" {
			return nil, fmt.Errorf("unknown compression algorithm: %s", compression)
		}

		fr, err := zlib.NewReader(bytes.NewReader(rawJSON))
		if err != nil {
			return nil, fmt.Errorf("error creating zlib reader: %w", err)
		}
		defer func() {
			if err := fr.Close(); err != nil {
				s.log.Warn("Failed closing zlib reader", "error", err)
			}
		}()

		rawJSON, err = io.ReadAll(fr)
		if err != nil {
			return nil, fmt.Errorf("error decompressing payload: %w", err)
		}
	}

	return rawJSON, nil
}

func (ss *SocialService) createOAuthConnector(name string, settings map[string]any, cfg *setting.Cfg, features *featuremgmt.FeatureManager, cache remotecache.CacheStorage) (SocialConnector, error) {
	switch name {
	case azureADProviderName:
		return NewAzureADProvider(settings, cfg, features, cache)
	case genericOAuthProviderName:
		return NewGenericOAuthProvider(settings, cfg, features)
	case gitHubProviderName:
		return NewGitHubProvider(settings, cfg, features)
	case gitlabProviderName:
		return NewGitLabProvider(settings, cfg, features)
	case googleProviderName:
		return NewGoogleProvider(settings, cfg, features)
	case grafanaComProviderName:
		return NewGrafanaComProvider(settings, cfg, features)
	case oktaProviderName:
		return NewOktaProvider(settings, cfg, features)
	default:
		return nil, fmt.Errorf("unknown oauth provider: %s", name)
	}
}

func appendUniqueScope(config *oauth2.Config, scope string) {
	if !slices.Contains(config.Scopes, OfflineAccessScope) {
		config.Scopes = append(config.Scopes, OfflineAccessScope)
	}
}
