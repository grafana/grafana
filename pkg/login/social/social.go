package social

import (
	"bytes"
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/services/org"
	"golang.org/x/oauth2"
)

const (
	OfflineAccessScope = "offline_access"
	RoleGrafanaAdmin   = "GrafanaAdmin" // For AzureAD for example this value cannot contain spaces

	// Values for ClientAuthentication under OAuthInfo (based on oidc spec)
	ClientSecretPost = "client_secret_post"
	None             = "none"
	// Azure AD
	ManagedIdentity  = "managed_identity"
	WorkloadIdentity = "workload_identity"
	// Other providers...

	AzureADProviderName      = "azuread"
	GenericOAuthProviderName = "generic_oauth"
	GitHubProviderName       = "github"
	GitlabProviderName       = "gitlab"
	GoogleProviderName       = "google"
	GrafanaComProviderName   = "grafana_com"
	// legacy/old settings for the provider
	GrafanaNetProviderName = "grafananet"
	OktaProviderName       = "okta"
	SAMLProviderName       = "saml"
	LDAPProviderName       = "ldap"
)

var SocialBaseUrl = "/login/"

type Service interface {
	GetOAuthProviders() map[string]bool
	GetOAuthHttpClient(string) (*http.Client, error)
	GetConnector(string) (SocialConnector, error)
	GetOAuthInfoProvider(string) *OAuthInfo
	GetOAuthInfoProviders() map[string]*OAuthInfo
}

//go:generate mockery --name SocialConnector --structname MockSocialConnector --outpkg socialtest --filename social_connector_mock.go --output ./socialtest/
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

type OAuthInfo struct {
	AllowAssignGrafanaAdmin     bool              `mapstructure:"allow_assign_grafana_admin" toml:"allow_assign_grafana_admin"`
	AllowSignup                 bool              `mapstructure:"allow_sign_up" toml:"allow_sign_up"`
	AllowedDomains              []string          `mapstructure:"allowed_domains" toml:"allowed_domains"`
	AllowedGroups               []string          `mapstructure:"allowed_groups" toml:"allowed_groups"`
	ApiUrl                      string            `mapstructure:"api_url" toml:"api_url"`
	AuthStyle                   string            `mapstructure:"auth_style" toml:"auth_style"`
	AuthUrl                     string            `mapstructure:"auth_url" toml:"auth_url"`
	AutoLogin                   bool              `mapstructure:"auto_login" toml:"auto_login"`
	ClientAuthentication        string            `mapstructure:"client_authentication" toml:"client_authentication"`
	ClientId                    string            `mapstructure:"client_id" toml:"client_id"`
	ClientSecret                string            `mapstructure:"client_secret" toml:"-"`
	ManagedIdentityClientID     string            `mapstructure:"managed_identity_client_id" toml:"managed_identity_client_id"`
	WorkloadIdentityTokenFile   string            `mapstructure:"workload_identity_token_file" toml:"workload_identity_token_file"`
	FederatedCredentialAudience string            `mapstructure:"federated_credential_audience" toml:"federated_credential_audience"`
	EmailAttributeName          string            `mapstructure:"email_attribute_name" toml:"email_attribute_name"`
	EmailAttributePath          string            `mapstructure:"email_attribute_path" toml:"email_attribute_path"`
	EmptyScopes                 bool              `mapstructure:"empty_scopes" toml:"empty_scopes"`
	Enabled                     bool              `mapstructure:"enabled" toml:"enabled"`
	GroupsAttributePath         string            `mapstructure:"groups_attribute_path" toml:"groups_attribute_path"`
	HostedDomain                string            `mapstructure:"hosted_domain" toml:"hosted_domain"`
	Icon                        string            `mapstructure:"icon" toml:"icon"`
	Name                        string            `mapstructure:"name" toml:"name"`
	RoleAttributePath           string            `mapstructure:"role_attribute_path" toml:"role_attribute_path"`
	RoleAttributeStrict         bool              `mapstructure:"role_attribute_strict" toml:"role_attribute_strict"`
	OrgAttributePath            string            `mapstructure:"org_attribute_path"`
	OrgMapping                  []string          `mapstructure:"org_mapping"`
	Scopes                      []string          `mapstructure:"scopes" toml:"scopes"`
	SignoutRedirectUrl          string            `mapstructure:"signout_redirect_url" toml:"signout_redirect_url"`
	SkipOrgRoleSync             bool              `mapstructure:"skip_org_role_sync" toml:"skip_org_role_sync"`
	TeamIdsAttributePath        string            `mapstructure:"team_ids_attribute_path" toml:"team_ids_attribute_path"`
	TeamsUrl                    string            `mapstructure:"teams_url" toml:"teams_url"`
	TlsClientCa                 string            `mapstructure:"tls_client_ca" toml:"tls_client_ca"`
	TlsClientCert               string            `mapstructure:"tls_client_cert" toml:"tls_client_cert"`
	TlsClientKey                string            `mapstructure:"tls_client_key" toml:"tls_client_key"`
	TlsSkipVerify               bool              `mapstructure:"tls_skip_verify_insecure" toml:"tls_skip_verify_insecure"`
	TokenUrl                    string            `mapstructure:"token_url" toml:"token_url"`
	UsePKCE                     bool              `mapstructure:"use_pkce" toml:"use_pkce"`
	UseRefreshToken             bool              `mapstructure:"use_refresh_token" toml:"use_refresh_token"`
	LoginPrompt                 string            `mapstructure:"login_prompt" toml:"login_prompt"`
	Extra                       map[string]string `mapstructure:",remain" toml:"extra,omitempty"`
}

func NewOAuthInfo() *OAuthInfo {
	return &OAuthInfo{
		Scopes:         []string{},
		AllowedDomains: []string{},
		AllowedGroups:  []string{},
		Extra:          map[string]string{},
	}
}

func (o *OAuthInfo) GetDisplayName() string {
	return o.Name
}

func (o *OAuthInfo) IsSingleLogoutEnabled() bool {
	// OIDC SLO is not supported
	return false
}

func (o *OAuthInfo) IsAutoLoginEnabled() bool {
	return o.AutoLogin
}

func (o *OAuthInfo) IsSkipOrgRoleSyncEnabled() bool {
	return o.SkipOrgRoleSync
}

func (o *OAuthInfo) IsAllowAssignGrafanaAdminEnabled() bool {
	return o.AllowAssignGrafanaAdmin
}

type BasicUserInfo struct {
	Id             string
	Name           string
	Email          string
	Login          string
	Role           org.RoleType
	OrgRoles       map[int64]org.RoleType
	IsGrafanaAdmin *bool // nil will avoid overriding user's set server admin setting
	Groups         []string
}

func (b *BasicUserInfo) String() string {
	return fmt.Sprintf("Id: %s, Name: %s, Email: %s, Login: %s, Role: %s, Groups: %v, OrgRoles: %v",
		b.Id, b.Name, b.Email, b.Login, b.Role, b.Groups, b.OrgRoles)
}
