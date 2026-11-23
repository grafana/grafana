package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-app-sdk/resource"
)

// Keys accepted in Connection.Secure. They must match the JSON names in ConnectionSecure.
const (
	ConnectionSecurePrivateKey   = "privateKey"
	ConnectionSecureClientSecret = "clientSecret"
	ConnectionSecureToken        = "token"
)

// ConnectionSecureKeys lists every key accepted in Connection.Secure.
var ConnectionSecureKeys = []string{ConnectionSecurePrivateKey, ConnectionSecureClientSecret, ConnectionSecureToken}

// ConnectionSecure only defines the OpenAPI schema of Connection.Secure, which
// is stored as a map. This comment is detached so the model keeps no description.

// +k8s:deepcopy-gen=false
type ConnectionSecure struct {
	// PrivateKey is the reference to the private key used for GitHub App authentication.
	// This value is stored securely and cannot be read back
	PrivateKey resource.InlineSecureValue `json:"privateKey,omitzero,omitempty"`

	// ClientSecret is the reference to the secret used for other providers authentication,
	// and Github on-behalf-of authentication.
	// This value is stored securely and cannot be read back
	ClientSecret resource.InlineSecureValue `json:"clientSecret,omitzero,omitempty"`

	// Token is the reference of the token used to act as the Connection.
	// This value is stored securely and cannot be read back
	Token resource.InlineSecureValue `json:"token,omitzero,omitempty"`
}

func (ConnectionSecure) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionSecure"
}

func (c *ConnectionSpec) IsGitHub() bool {
	return c.Github != nil || c.GithubEnterprise != nil
}

// ConnectionAuthorizeRequest completes the OAuth authorization of a connection
// by exchanging an authorization code for tokens. It is the request and
// response body of the connection authorize subresource.
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:deepcopy-gen=true
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

// +k8s:deepcopy-gen=true
type ConnectionAuthorizeRequestSpec struct {
	// The authorization code returned by the provider
	Code string `json:"code"`

	// The redirect URI used in the authorization request
	RedirectURI string `json:"redirectURI,omitempty"`
}

func (ConnectionAuthorizeRequestSpec) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionAuthorizeRequestSpec"
}

// +k8s:deepcopy-gen=true
type ConnectionAuthorizeRequestStatus struct {
	// Whether the connection has been authorized
	Authorized bool `json:"authorized"`
}

func (ConnectionAuthorizeRequestStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "ConnectionAuthorizeRequestStatus"
}

// ExternalRepositoryList lists repositories from an external git provider
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
// +k8s:deepcopy-gen=true
type ExternalRepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ExternalRepository `json:"items"`
}

func (ExternalRepositoryList) OpenAPIModelName() string {
	return OpenAPIPrefix + "ExternalRepositoryList"
}

// +k8s:deepcopy-gen=true
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
