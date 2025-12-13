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
	// Reference to the private key for GitHub App authentication
	// This value is stored securely and cannot be read back
	PrivateKey common.InlineSecureValue `json:"privateKey,omitzero,omitempty"`

	// Reference to the webhook secret for validating GitHub webhook requests
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

	// GitHub connection configuration
	// Only applicable when provider is "github"
	GitHub *GitHubConnectionConfig `json:"github,omitempty"`
}

// ConnectionState defines the state of a Connection
// +enum
type ConnectionState string

// ConnectionState values
const (
	ConnectionStatePending      ConnectionState = "pending"
	ConnectionStateActive       ConnectionState = "active"
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
