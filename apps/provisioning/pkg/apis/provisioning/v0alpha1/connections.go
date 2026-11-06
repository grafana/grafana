package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type ConnectionSecure struct {
	// PrivateKey is the reference to the private key used for GitHub App authentication.
	// This value is stored securely and cannot be read back
	PrivateKey common.InlineSecureValue `json:"privateKey,omitzero,omitempty"`

	// ClientSecret is the reference to the secret used for other providers authentication,
	// and Github on-behalf-of authentication.
	// This value is stored securely and cannot be read back
	ClientSecret common.InlineSecureValue `json:"clientSecret,omitzero,omitempty"`

	// Token is the reference of the token used to act as the Connection.
	// This value is stored securely and cannot be read back
	Token common.InlineSecureValue `json:"token,omitzero,omitempty"`
}

func (ConnectionSecure) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionSecure"
}

func (v ConnectionSecure) IsZero() bool {
	return v.PrivateKey.IsZero() && v.Token.IsZero() && v.ClientSecret.IsZero()
}

// ConnectionType defines the types of Connection providers
// +enum
type ConnectionType string

func (ConnectionType) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionType"
}

// ConnectionType values.
const (
	GithubConnectionType                ConnectionType = "github"
	GithubEnterpriseConnectionType      ConnectionType = "githubEnterprise"
	GithubOAuthConnectionType           ConnectionType = "githubOAuth"
	GithubEnterpriseOAuthConnectionType ConnectionType = "githubEnterpriseOAuth"
	GitlabOAuthConnectionType           ConnectionType = "gitlabOAuth"
	BitbucketOAuthConnectionType        ConnectionType = "bitbucketOAuth"
	GitOAuthConnectionType              ConnectionType = "gitOAuth"
)

func (c *ConnectionSpec) IsGitHub() bool {
	return c.GitHub != nil || c.GitHubEnterprise != nil
}

// ConnectionAuthorizeRequest completes the OAuth authorization of a connection
// by exchanging an authorization code for tokens. It is the request and
// response body of the connection authorize subresource.
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ConnectionAuthorizeRequest struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec ConnectionAuthorizeRequestSpec `json:"spec"`

	// +optional
	Status ConnectionAuthorizeRequestStatus `json:"status,omitempty"`
}

func (ConnectionAuthorizeRequest) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionAuthorizeRequest"
}

type ConnectionAuthorizeRequestSpec struct {
	// The authorization code returned by the provider
	Code string `json:"code"`

	// The redirect URI used in the authorization request
	RedirectURI string `json:"redirectURI,omitempty"`
}

func (ConnectionAuthorizeRequestSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionAuthorizeRequestSpec"
}

type ConnectionAuthorizeRequestStatus struct {
	// Whether the connection has been authorized
	Authorized bool `json:"authorized"`
}

func (ConnectionAuthorizeRequestStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionAuthorizeRequestStatus"
}

// ExternalRepositoryList lists repositories from an external git provider
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalRepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ExternalRepository `json:"items"`
}

func (ExternalRepositoryList) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalRepositoryList"
}

type ExternalRepository struct {
	// Name of the repository
	Name string `json:"name"`
	// Owner is the user, organization, or workspace that owns the repository
	// For GitHub: organization or user
	// For GitLab: namespace (user or group)
	// For Bitbucket: workspace
	// For pure Git: empty
	Owner string `json:"owner,omitempty"`
	// URL of the repository
	URL string `json:"url"`
}

func (ExternalRepository) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalRepository"
}
