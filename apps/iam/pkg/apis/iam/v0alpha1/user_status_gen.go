// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type UserStatus struct {
	LastSeenAt int64 `json:"lastSeenAt"`
}

// NewUserStatus creates a new UserStatus object.
func NewUserStatus() *UserStatus {
	return &UserStatus{}
}
