// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +enum
// +k8s:openapi-gen=true
type ConnectionType string

const (
	ConnectionTypeGithub                ConnectionType = "github"
	ConnectionTypeGithubEnterprise      ConnectionType = "githubEnterprise"
	ConnectionTypeGithubOAuth           ConnectionType = "githubOAuth"
	ConnectionTypeGithubEnterpriseOAuth ConnectionType = "githubEnterpriseOAuth"
	ConnectionTypeGitlabOAuth           ConnectionType = "gitlabOAuth"
	ConnectionTypeBitbucketOAuth        ConnectionType = "bitbucketOAuth"
	ConnectionTypeGitOAuth              ConnectionType = "gitOAuth"
)

// OpenAPIModelName returns the OpenAPI model name for ConnectionType.
func (ConnectionType) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionType"
}

// +k8s:openapi-gen=true
type ConnectionGitHubConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
}

// NewConnectionGitHubConfig creates a new ConnectionGitHubConfig object.
func NewConnectionGitHubConfig() *ConnectionGitHubConfig {
	return &ConnectionGitHubConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubConfig.
func (ConnectionGitHubConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionGitHubConfig"
}

// +k8s:openapi-gen=true
type ConnectionGitHubEnterpriseConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerUrl string `json:"serverUrl"`
}

// NewConnectionGitHubEnterpriseConfig creates a new ConnectionGitHubEnterpriseConfig object.
func NewConnectionGitHubEnterpriseConfig() *ConnectionGitHubEnterpriseConfig {
	return &ConnectionGitHubEnterpriseConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubEnterpriseConfig.
func (ConnectionGitHubEnterpriseConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionGitHubEnterpriseConfig"
}

// +k8s:openapi-gen=true
type ConnectionGitHubEnterpriseOAuthConfig struct {
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerUrl string `json:"serverUrl"`
}

// NewConnectionGitHubEnterpriseOAuthConfig creates a new ConnectionGitHubEnterpriseOAuthConfig object.
func NewConnectionGitHubEnterpriseOAuthConfig() *ConnectionGitHubEnterpriseOAuthConfig {
	return &ConnectionGitHubEnterpriseOAuthConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitHubEnterpriseOAuthConfig.
func (ConnectionGitHubEnterpriseOAuthConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionGitHubEnterpriseOAuthConfig"
}

// +k8s:openapi-gen=true
type ConnectionBitbucketConfig struct {
	// The workspace the OAuth consumer belongs to
	Workspace string `json:"workspace"`
}

// NewConnectionBitbucketConfig creates a new ConnectionBitbucketConfig object.
func NewConnectionBitbucketConfig() *ConnectionBitbucketConfig {
	return &ConnectionBitbucketConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionBitbucketConfig.
func (ConnectionBitbucketConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionBitbucketConfig"
}

// +k8s:openapi-gen=true
type ConnectionGitOAuthConfig struct {
	// The provider's OAuth authorization endpoint (e.g. `https://gitlab.example.com/oauth/authorize`).
	AuthURL string `json:"authURL"`
	// The provider's OAuth token endpoint (e.g. `https://gitlab.example.com/oauth/token`).
	TokenURL string `json:"tokenURL"`
	// The OAuth scopes to request, granting git read and write access.
	Scopes []string `json:"scopes,omitempty"`
}

// NewConnectionGitOAuthConfig creates a new ConnectionGitOAuthConfig object.
func NewConnectionGitOAuthConfig() *ConnectionGitOAuthConfig {
	return &ConnectionGitOAuthConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionGitOAuthConfig.
func (ConnectionGitOAuthConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionGitOAuthConfig"
}

// +k8s:openapi-gen=true
type ConnectionOAuthConfig struct {
	// The OAuth app client ID
	ClientID string `json:"clientID"`
}

// NewConnectionOAuthConfig creates a new ConnectionOAuthConfig object.
func NewConnectionOAuthConfig() *ConnectionOAuthConfig {
	return &ConnectionOAuthConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionOAuthConfig.
func (ConnectionOAuthConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionOAuthConfig"
}

// +k8s:openapi-gen=true
type ConnectionWebhookConfig struct {
	// Disabled disables webhook integration for this connection. When true, the GitHub
	// App does not require webhooks:write permission and Grafana will not register or receive
	// webhook events. Use this when Grafana is not reachable from the public internet.
	Disabled *bool `json:"disabled,omitempty"`
}

// NewConnectionWebhookConfig creates a new ConnectionWebhookConfig object.
func NewConnectionWebhookConfig() *ConnectionWebhookConfig {
	return &ConnectionWebhookConfig{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionWebhookConfig.
func (ConnectionWebhookConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionWebhookConfig"
}

// +k8s:openapi-gen=true
type ConnectionSpec struct {
	// The connection display name (shown in the UI)
	Title string `json:"title"`
	// The connection description
	Description *string `json:"description,omitempty"`
	// The connection provider type
	Type ConnectionType `json:"type"`
	// The connection URL
	Url *string `json:"url,omitempty"`
	// GitHub connection configuration
	// Only applicable when provider is "github"
	Github *ConnectionGitHubConfig `json:"github,omitempty"`
	// GitHub Enterprise Server connection configuration
	// Only applicable when provider is "githubEnterprise"
	GithubEnterprise *ConnectionGitHubEnterpriseConfig `json:"githubEnterprise,omitempty"`
	// GitHub Enterprise Server OAuth app connection configuration
	// Only applicable when provider is "githubEnterpriseOAuth"
	GithubEnterpriseOAuth *ConnectionGitHubEnterpriseOAuthConfig `json:"githubEnterpriseOAuth,omitempty"`
	// Bitbucket connection configuration
	// Only applicable when provider is "bitbucketOAuth"
	Bitbucket *ConnectionBitbucketConfig `json:"bitbucket,omitempty"`
	// Generic git OAuth app connection configuration
	// Only applicable when provider is "gitOAuth"
	GitOAuth *ConnectionGitOAuthConfig `json:"gitOAuth,omitempty"`
	// OAuth app configuration shared by all OAuth app providers
	Oauth *ConnectionOAuthConfig `json:"oauth,omitempty"`
	// Webhook configuration for this connection
	Webhook *ConnectionWebhookConfig `json:"webhook,omitempty"`
}

// NewConnectionSpec creates a new ConnectionSpec object.
func NewConnectionSpec() *ConnectionSpec {
	return &ConnectionSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionSpec.
func (ConnectionSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionSpec"
}
