// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserStorageSpec struct {
	// Data is the key:value stored in the user storage for a service.
	Data map[string]string `json:"data"`
}

// NewUserStorageSpec creates a new UserStorageSpec object.
func NewUserStorageSpec() *UserStorageSpec {
	return &UserStorageSpec{
		Data: map[string]string{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserStorageSpec.
func (UserStorageSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.userstorage.pkg.apis.userstorage.v0alpha1.UserStorageSpec"
}
