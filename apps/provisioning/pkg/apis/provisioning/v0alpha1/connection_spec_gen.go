// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type GitHubConnectionConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
}

// OpenAPIModelName returns the OpenAPI model name for GitHubConnectionConfig.
func (GitHubConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitHubConnectionConfig"
}

// GitHubEnterpriseConnectionConfig describes a GitHub App installation against a
// self-managed GitHub Enterprise Server (GHES) instance.
// +k8s:openapi-gen=true
type GitHubEnterpriseConnectionConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`
	// GitHub App installation ID
	InstallationID string `json:"installationID"`
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerURL string `json:"serverUrl"`
}

// OpenAPIModelName returns the OpenAPI model name for GitHubEnterpriseConnectionConfig.
func (GitHubEnterpriseConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitHubEnterpriseConnectionConfig"
}

// +k8s:openapi-gen=true
type GitHubEnterpriseOAuthConnectionConfig struct {
	// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
	ServerURL string `json:"serverUrl"`
}

// OpenAPIModelName returns the OpenAPI model name for GitHubEnterpriseOAuthConnectionConfig.
func (GitHubEnterpriseOAuthConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitHubEnterpriseOAuthConnectionConfig"
}

// +k8s:openapi-gen=true
type BitbucketConnectionConfig struct {
	// The workspace the OAuth consumer belongs to
	Workspace string `json:"workspace"`
}

// OpenAPIModelName returns the OpenAPI model name for BitbucketConnectionConfig.
func (BitbucketConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.BitbucketConnectionConfig"
}

// GitOAuthConnectionConfig describes a provider-agnostic OAuth 2.0 app used to
// authenticate pure git repositories.
// +k8s:openapi-gen=true
type GitOAuthConnectionConfig struct {
	// The provider's OAuth authorization endpoint (e.g. `https://gitlab.example.com/oauth/authorize`).
	AuthURL string `json:"authURL"`
	// The provider's OAuth token endpoint (e.g. `https://gitlab.example.com/oauth/token`).
	TokenURL string `json:"tokenURL"`
	// The OAuth scopes to request, granting git read and write access.
	// +listType=atomic
	Scopes []string `json:"scopes,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for GitOAuthConnectionConfig.
func (GitOAuthConnectionConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.GitOAuthConnectionConfig"
}

// +k8s:openapi-gen=true
type ConnectionOAuthConfig struct {
	// The OAuth app client ID
	ClientID string `json:"clientID"`
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
	Disabled bool `json:"disabled,omitempty"`
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
	Description string `json:"description,omitempty"`
	// The connection provider type
	Type ConnectionType `json:"type"`
	// The connection URL
	URL string `json:"url,omitempty"`
	// GitHub connection configuration
	// Only applicable when provider is "github"
	GitHub *GitHubConnectionConfig `json:"github,omitempty"`
	// GitHub Enterprise Server connection configuration
	// Only applicable when provider is "githubEnterprise"
	GitHubEnterprise *GitHubEnterpriseConnectionConfig `json:"githubEnterprise,omitempty"`
	// GitHub Enterprise Server OAuth app connection configuration
	// Only applicable when provider is "githubEnterpriseOAuth"
	GitHubEnterpriseOAuth *GitHubEnterpriseOAuthConnectionConfig `json:"githubEnterpriseOAuth,omitempty"`
	// Bitbucket connection configuration
	// Only applicable when provider is "bitbucketOAuth"
	Bitbucket *BitbucketConnectionConfig `json:"bitbucket,omitempty"`
	// Generic git OAuth app connection configuration
	// Only applicable when provider is "gitOAuth"
	GitOAuth *GitOAuthConnectionConfig `json:"gitOAuth,omitempty"`
	// OAuth app configuration shared by all OAuth app providers
	OAuth *ConnectionOAuthConfig `json:"oauth,omitempty"`
	// Webhook configuration for this connection
	Webhook *ConnectionWebhookConfig `json:"webhook,omitempty"`
}

// OpenAPIModelName returns the OpenAPI model name for ConnectionSpec.
func (ConnectionSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.provisioning.pkg.apis.provisioning.v0alpha1.ConnectionSpec"
}
