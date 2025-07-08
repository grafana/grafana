// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ServiceAccountSpec struct {
	Title    string `json:"title"`
	Disabled bool   `json:"disabled"`
}

// NewServiceAccountSpec creates a new ServiceAccountSpec object.
func NewServiceAccountSpec() *ServiceAccountSpec {
	return &ServiceAccountSpec{}
}
