package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// When this code is changed, make sure to update the code generation.
// As of writing, this can be done via the hack dir in the root of the repo: ./hack/update-codegen.sh provisioning
// If you've opened the generated files in this dir at some point in VSCode, you may also have to re-open them to clear errors.
// +genclient
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Connection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   ConnectionSpec   `json:"spec,omitempty"`
	Secure ConnectionSecure `json:"secure,omitzero,omitempty"`
	Status ConnectionStatus `json:"status,omitempty"`
}

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
	Token common.InlineSecureValue `json:"webhook,omitzero,omitempty"`
}

func (v ConnectionSecure) IsZero() bool {
	return v.PrivateKey.IsZero() && v.Token.IsZero()
}

type GitHubConnectionConfig struct {
	// GitHub App ID
	AppID string `json:"appID"`

	// GitHub App installation ID
	InstallationID string `json:"installationID"`
}

type BitbucketConnectionConfig struct {
	// App client ID
	ClientID string `json:"clientID"`
}

type GitlabConnectionConfig struct {
	// App client ID
	ClientID string `json:"clientID"`
}

// ConnectionType defines the types of Connection providers
// +enum
type ConnectionType string

// ConnectionType values.
const (
	GithubConnectionType    ConnectionType = "github"
	GitlabConnectionType    ConnectionType = "gitlab"
	BitbucketConnectionType ConnectionType = "bitbucket"
)

type ConnectionSpec struct {
	// The connection provider type
	Type ConnectionType `json:"type"`
	// The connection URL
	URL string `json:"url,omitempty"`

	// GitHub connection configuration
	// Only applicable when provider is "github"
	GitHub *GitHubConnectionConfig `json:"github,omitempty"`
	// Bitbucket connection configuration
	// Only applicable when provider is "bitbucket"
	Bitbucket *BitbucketConnectionConfig `json:"bitbucket,omitempty"`
	// Gitlab connection configuration
	// Only applicable when provider is "gitlab"
	Gitlab *GitlabConnectionConfig `json:"gitlab,omitempty"`
}

// ConnectionState defines the state of a Connection
// +enum
type ConnectionState string

// ConnectionState values
const (
	ConnectionStateConnected    ConnectionState = "connected"
	ConnectionStateDisconnected ConnectionState = "disconnected"
)

// The status of a Connection.
// This is expected never to be created by a kubectl call or similar, and is expected to rarely (if ever) be edited manually.
type ConnectionStatus struct {
	// The generation of the spec last time reconciliation ran
	ObservedGeneration int64 `json:"observedGeneration"`

	// Connection state
	State ConnectionState `json:"state"`

	// The connection health status
	Health HealthStatus `json:"health"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ConnectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []Connection `json:"items"`
}

// ExternalRepositoryList lists repositories from an external git provider
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type ExternalRepositoryList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=atomic
	Items []ExternalRepository `json:"items"`
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
