// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type ServiceAccountSpec struct {
	AvatarUrl string `json:"avatarUrl"`
	Disabled  bool   `json:"disabled"`
	Login     string `json:"login"`
	External  bool   `json:"external"`
	Title     string `json:"title"`
}

// NewServiceAccountSpec creates a new ServiceAccountSpec object.
func NewServiceAccountSpec() *ServiceAccountSpec {
	return &ServiceAccountSpec{
		Disabled: false,
		External: false,
	}
}
