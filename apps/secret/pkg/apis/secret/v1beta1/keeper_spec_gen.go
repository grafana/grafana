// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v1beta1

// +k8s:openapi-gen=true
type KeeperAWSConfig struct {
	Region     string               `json:"region"`
	AssumeRole *KeeperAWSAssumeRole `json:"assumeRole,omitempty"`
}

// NewKeeperAWSConfig creates a new KeeperAWSConfig object.
func NewKeeperAWSConfig() *KeeperAWSConfig {
	return &KeeperAWSConfig{}
}

// +k8s:openapi-gen=true
type KeeperAWSAssumeRole struct {
	AssumeRoleArn string `json:"assumeRoleArn"`
	ExternalID    string `json:"externalID"`
}

// NewKeeperAWSAssumeRole creates a new KeeperAWSAssumeRole object.
func NewKeeperAWSAssumeRole() *KeeperAWSAssumeRole {
	return &KeeperAWSAssumeRole{}
}

// +k8s:openapi-gen=true
type KeeperSpec struct {
	// Short description for the Keeper.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	Description string `json:"description"`
	// AWS Keeper Configuration.
	// +structType=atomic
	// +optional
	Aws *KeeperAWSConfig `json:"aws,omitempty"`
}

// NewKeeperSpec creates a new KeeperSpec object.
func NewKeeperSpec() *KeeperSpec {
	return &KeeperSpec{}
}
func (KeeperAWSConfig) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.secret.pkg.apis.secret.v1beta1.KeeperAWSConfig"
}
func (KeeperAWSAssumeRole) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.secret.pkg.apis.secret.v1beta1.KeeperAWSAssumeRole"
}
func (KeeperSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.secret.pkg.apis.secret.v1beta1.KeeperSpec"
}
