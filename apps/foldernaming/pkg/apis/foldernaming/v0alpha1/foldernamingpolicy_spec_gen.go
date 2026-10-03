// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type FolderNamingPolicyEnforcement string

const (
	FolderNamingPolicyEnforcementDeny FolderNamingPolicyEnforcement = "Deny"
	FolderNamingPolicyEnforcementWarn FolderNamingPolicyEnforcement = "Warn"
)

// OpenAPIModelName returns the OpenAPI model name for FolderNamingPolicyEnforcement.
func (FolderNamingPolicyEnforcement) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.foldernaming.pkg.apis.foldernaming.v0alpha1.FolderNamingPolicyEnforcement"
}

// +k8s:openapi-gen=true
type FolderNamingPolicySpec struct {
	// What happens when a folder title breaks the convention. Deny rejects the write. Warn admits
	// it with a warning, so a convention can be assessed before it is enforced.
	Enforcement FolderNamingPolicyEnforcement `json:"enforcement"`
	// An RE2 regular expression the whole folder title must match, e.g. "[a-z0-9-]+: .+".
	TitlePattern string `json:"titlePattern"`
	// Explains the convention to whoever breaks it, e.g. "Start with the owning team, like 'team-a: Alerts'".
	Description *string `json:"description,omitempty"`
}

// NewFolderNamingPolicySpec creates a new FolderNamingPolicySpec object.
func NewFolderNamingPolicySpec() *FolderNamingPolicySpec {
	return &FolderNamingPolicySpec{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderNamingPolicySpec.
func (FolderNamingPolicySpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.foldernaming.pkg.apis.foldernaming.v0alpha1.FolderNamingPolicySpec"
}
