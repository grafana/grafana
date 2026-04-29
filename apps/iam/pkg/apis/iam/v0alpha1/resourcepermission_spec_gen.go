// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ResourcePermissionspecResource struct {
	// api group of the resource (e.g: "folder.grafana.app")
	ApiGroup string `json:"apiGroup"`
	// kind of the resource (e.g: "folders")
	Resource string `json:"resource"`
	// uid of the resource (e.g: "fold1")
	Name string `json:"name"`
}

// NewResourcePermissionspecResource creates a new ResourcePermissionspecResource object.
func NewResourcePermissionspecResource() *ResourcePermissionspecResource {
	return &ResourcePermissionspecResource{}
}

// OpenAPIModelName returns the OpenAPI model name for ResourcePermissionspecResource.
func (ResourcePermissionspecResource) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ResourcePermissionspecResource"
}

// +k8s:openapi-gen=true
type ResourcePermissionspecPermission struct {
	// kind of the identity getting the permission
	Kind ResourcePermissionSpecPermissionKind `json:"kind"`
	// uid of the identity getting the permission
	Name string `json:"name"`
	// action set granted to the user (e.g. "admin" or "edit", "view")
	Verb string `json:"verb"`
}

// NewResourcePermissionspecPermission creates a new ResourcePermissionspecPermission object.
func NewResourcePermissionspecPermission() *ResourcePermissionspecPermission {
	return &ResourcePermissionspecPermission{}
}

// OpenAPIModelName returns the OpenAPI model name for ResourcePermissionspecPermission.
func (ResourcePermissionspecPermission) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ResourcePermissionspecPermission"
}

// +k8s:openapi-gen=true
type ResourcePermissionSpec struct {
	Resource    ResourcePermissionspecResource     `json:"resource"`
	Permissions []ResourcePermissionspecPermission `json:"permissions"`
}

// NewResourcePermissionSpec creates a new ResourcePermissionSpec object.
func NewResourcePermissionSpec() *ResourcePermissionSpec {
	return &ResourcePermissionSpec{
		Resource:    *NewResourcePermissionspecResource(),
		Permissions: []ResourcePermissionspecPermission{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ResourcePermissionSpec.
func (ResourcePermissionSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ResourcePermissionSpec"
}

// +k8s:openapi-gen=true
type ResourcePermissionSpecPermissionKind string

const (
	ResourcePermissionSpecPermissionKindUser           ResourcePermissionSpecPermissionKind = "User"
	ResourcePermissionSpecPermissionKindServiceAccount ResourcePermissionSpecPermissionKind = "ServiceAccount"
	ResourcePermissionSpecPermissionKindTeam           ResourcePermissionSpecPermissionKind = "Team"
	ResourcePermissionSpecPermissionKindBasicRole      ResourcePermissionSpecPermissionKind = "BasicRole"
)

// OpenAPIModelName returns the OpenAPI model name for ResourcePermissionSpecPermissionKind.
func (ResourcePermissionSpecPermissionKind) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.ResourcePermissionSpecPermissionKind"
}
