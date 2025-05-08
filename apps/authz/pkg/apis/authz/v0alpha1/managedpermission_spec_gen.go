// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ManagedPermissionspecResource struct {
	// api group of the resource (e.g: "folder.grafana.app")
	ApiGroup string `json:"apiGroup"`
	// kind of the resource (e.g: "folders")
	Resource string `json:"resource"`
	// uid of the resource (e.g: "fold1")
	Name string `json:"name"`
}

// NewManagedPermissionspecResource creates a new ManagedPermissionspecResource object.
func NewManagedPermissionspecResource() *ManagedPermissionspecResource {
	return &ManagedPermissionspecResource{}
}

// +k8s:openapi-gen=true
type ManagedPermissionspecPermission struct {
	// kind of the identity getting the permission
	Kind ManagedPermissionSpecPermissionKind `json:"kind"`
	// uid of the identity getting the permission
	Name string `json:"name"`
	// list of actions granted to the user (e.g. "admin" or "get", "update")
	Verbs []string `json:"verbs"`
}

// NewManagedPermissionspecPermission creates a new ManagedPermissionspecPermission object.
func NewManagedPermissionspecPermission() *ManagedPermissionspecPermission {
	return &ManagedPermissionspecPermission{
		Verbs: []string{},
	}
}

// +k8s:openapi-gen=true
type ManagedPermissionSpec struct {
	Resource    ManagedPermissionspecResource     `json:"resource"`
	Permissions []ManagedPermissionspecPermission `json:"permissions"`
}

// NewManagedPermissionSpec creates a new ManagedPermissionSpec object.
func NewManagedPermissionSpec() *ManagedPermissionSpec {
	return &ManagedPermissionSpec{
		Resource:    *NewManagedPermissionspecResource(),
		Permissions: []ManagedPermissionspecPermission{},
	}
}

// +k8s:openapi-gen=true
type ManagedPermissionSpecPermissionKind string

const (
	ManagedPermissionSpecPermissionKindUser           ManagedPermissionSpecPermissionKind = "User"
	ManagedPermissionSpecPermissionKindServiceAccount ManagedPermissionSpecPermissionKind = "ServiceAccount"
	ManagedPermissionSpecPermissionKindTeam           ManagedPermissionSpecPermissionKind = "Team"
	ManagedPermissionSpecPermissionKindBasicRole      ManagedPermissionSpecPermissionKind = "BasicRole"
)
