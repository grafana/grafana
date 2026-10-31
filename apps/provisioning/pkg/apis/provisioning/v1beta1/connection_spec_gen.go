// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type ConnectionGitHubConnectionConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
}

// NewConnectionGitHubConnectionConfig creates a new ConnectionGitHubConnectionConfig object.
func NewConnectionGitHubConnectionConfig() *ConnectionGitHubConnectionConfig {
	return &ConnectionGitHubConnectionConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubConnectionConfig.
func (ConnectionGitHubConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionGitHubConnectionConfig"
}

// GitHubEnterpriseConnectionConfig describes a GitHub App installation against a
// self-managed GitHub Enterprise Server (GHES) instance.
// +k8s:openapi-gen=true
type ConnectionGitHubEnterpriseConnectionConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerUrl string `json:"serverUrl"`
}

// NewConnectionGitHubEnterpriseConnectionConfig creates a new ConnectionGitHubEnterpriseConnectionConfig object.
func NewConnectionGitHubEnterpriseConnectionConfig() *ConnectionGitHubEnterpriseConnectionConfig {
	return &ConnectionGitHubEnterpriseConnectionConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubEnterpriseConnectionConfig.
func (ConnectionGitHubEnterpriseConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionGitHubEnterpriseConnectionConfig"
}

// +k8s:openapi-gen=true
type ConnectionGitHubEnterpriseOAuthConnectionConfig struct {
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerUrl string `json:"serverUrl"`
}

// NewConnectionGitHubEnterpriseOAuthConnectionConfig creates a new ConnectionGitHubEnterpriseOAuthConnectionConfig object.
func NewConnectionGitHubEnterpriseOAuthConnectionConfig() *ConnectionGitHubEnterpriseOAuthConnectionConfig {
	return &ConnectionGitHubEnterpriseOAuthConnectionConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubEnterpriseOAuthConnectionConfig.
func (ConnectionGitHubEnterpriseOAuthConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionGitHubEnterpriseOAuthConnectionConfig"
}

// +k8s:openapi-gen=true
type ConnectionBitbucketConnectionConfig struct {
	// The workspace the OAuth consumer belongs to
	Workspace string `json:"workspace"`
}

// NewConnectionBitbucketConnectionConfig creates a new ConnectionBitbucketConnectionConfig object.
func NewConnectionBitbucketConnectionConfig() *ConnectionBitbucketConnectionConfig {
	return &ConnectionBitbucketConnectionConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionBitbucketConnectionConfig.
func (ConnectionBitbucketConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionBitbucketConnectionConfig"
}

// GitOAuthConnectionConfig describes a provider-agnostic OAuth 2.0 app used to
// authenticate pure git repositories.
// +k8s:openapi-gen=true
type ConnectionGitOAuthConnectionConfig struct {
	// The provider's OAuth authorization endpoint (e.g. `https://gitlab.example.com/oauth/authorize`).
	AuthURL string `json:"authURL"`
	// The provider's OAuth token endpoint (e.g. `https://gitlab.example.com/oauth/token`).
	TokenURL string `json:"tokenURL"`
	// The OAuth scopes to request, granting git read and write access.
	Scopes []string `json:"scopes,omitempty"`
}

// NewConnectionGitOAuthConnectionConfig creates a new ConnectionGitOAuthConnectionConfig object.
func NewConnectionGitOAuthConnectionConfig() *ConnectionGitOAuthConnectionConfig {
	return &ConnectionGitOAuthConnectionConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitOAuthConnectionConfig.
func (ConnectionGitOAuthConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionGitOAuthConnectionConfig"
}

// +k8s:openapi-gen=true
type ConnectionConnectionOAuthConfig struct {
	// The OAuth app client ID
	ClientID string `json:"clientID"`
}

// NewConnectionConnectionOAuthConfig creates a new ConnectionConnectionOAuthConfig object.
func NewConnectionConnectionOAuthConfig() *ConnectionConnectionOAuthConfig {
	return &ConnectionConnectionOAuthConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionConnectionOAuthConfig.
func (ConnectionConnectionOAuthConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionConnectionOAuthConfig"
}

// +k8s:openapi-gen=true
type ConnectionConnectionWebhookConfig struct {
	// Disabled disables webhook integration for this connection. When true, the GitHub
	// App does not require webhooks:write permission and Grafana will not register or receive
	// webhook events. Use this when Grafana is not reachable from the public internet.
	Disabled *bool `json:"disabled,omitempty"`
}

// NewConnectionConnectionWebhookConfig creates a new ConnectionConnectionWebhookConfig object.
func NewConnectionConnectionWebhookConfig() *ConnectionConnectionWebhookConfig {
	return &ConnectionConnectionWebhookConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionConnectionWebhookConfig.
func (ConnectionConnectionWebhookConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionConnectionWebhookConfig"
}

// +k8s:openapi-gen=true
type ConnectionSpec struct {
	// The connection display name (shown in the UI)
	Title string `json:"title"`
	// The connection description
	Description *string `json:"description,omitempty"`
	// The connection provider type
	Type ConnectionSpecType `json:"type"`
	// The connection URL
	Url *string `json:"url,omitempty"`
	// GitHub connection configuration
	// Only applicable when provider is "github"
	Github *ConnectionGitHubConnectionConfig `json:"github,omitempty"`
	// GitHub Enterprise Server connection configuration
	// Only applicable when provider is "githubEnterprise"
	GithubEnterprise *ConnectionGitHubEnterpriseConnectionConfig `json:"githubEnterprise,omitempty"`
	// GitHub Enterprise Server OAuth app connection configuration
	// Only applicable when provider is "githubEnterpriseOAuth"
	GithubEnterpriseOAuth *ConnectionGitHubEnterpriseOAuthConnectionConfig `json:"githubEnterpriseOAuth,omitempty"`
	// Bitbucket connection configuration
	// Only applicable when provider is "bitbucketOAuth"
	Bitbucket *ConnectionBitbucketConnectionConfig `json:"bitbucket,omitempty"`
	// Generic git OAuth app connection configuration
	// Only applicable when provider is "gitOAuth"
	GitOAuth *ConnectionGitOAuthConnectionConfig `json:"gitOAuth,omitempty"`
	// OAuth app configuration shared by all OAuth app providers
	Oauth *ConnectionConnectionOAuthConfig `json:"oauth,omitempty"`
	// Webhook configuration for this connection
	Webhook *ConnectionConnectionWebhookConfig `json:"webhook,omitempty"`
}

// NewConnectionSpec creates a new ConnectionSpec object.
func NewConnectionSpec() *ConnectionSpec {
	return &ConnectionSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionSpec.
func (ConnectionSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionSpec"
}

// +k8s:openapi-gen=true
type ConnectionSpecType string

const (
	ConnectionSpecTypeGithub                ConnectionSpecType = "github"
	ConnectionSpecTypeGithubEnterprise      ConnectionSpecType = "githubEnterprise"
	ConnectionSpecTypeGithubOAuth           ConnectionSpecType = "githubOAuth"
	ConnectionSpecTypeGithubEnterpriseOAuth ConnectionSpecType = "githubEnterpriseOAuth"
	ConnectionSpecTypeGitlabOAuth           ConnectionSpecType = "gitlabOAuth"
	ConnectionSpecTypeBitbucketOAuth        ConnectionSpecType = "bitbucketOAuth"
	ConnectionSpecTypeGitOAuth              ConnectionSpecType = "gitOAuth"
)

// OpenAPIModelName returns the OpenAPI model name for ConnectionSpecType.
func (ConnectionSpecType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v1beta1.ConnectionSpecType"
}
