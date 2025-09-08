// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ServiceAccountOrgRole string

const (
	ServiceAccountOrgRoleNone   ServiceAccountOrgRole = "None"
	ServiceAccountOrgRoleViewer ServiceAccountOrgRole = "Viewer"
	ServiceAccountOrgRoleEditor ServiceAccountOrgRole = "Editor"
	ServiceAccountOrgRoleAdmin  ServiceAccountOrgRole = "Admin"
)

// +k8s:openapi-gen=true
type ServiceAccountSpec struct {
	Disabled bool                  `json:"disabled"`
	Plugin   string                `json:"plugin"`
	Role     ServiceAccountOrgRole `json:"role"`
	Title    string                `json:"title"`
}

// NewServiceAccountSpec creates a new ServiceAccountSpec object.
func NewServiceAccountSpec() *ServiceAccountSpec {
	return &ServiceAccountSpec{
		Disabled: false,
	}
}
