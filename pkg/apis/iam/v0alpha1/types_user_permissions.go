package v0alpha1

// UserPermission is one effective action and scope granted to an identity.
type UserPermission struct {
	Action string `json:"action"`
	Scope  string `json:"scope"`
}

func (UserPermission) OpenAPIModelName() string {
	return OpenAPIPrefix + "UserPermission"
}

// UserPermissions contains the effective permissions for the current identity.
type UserPermissions struct {
	// +listType=atomic
	Permissions []UserPermission `json:"permissions"`
}

func (UserPermissions) OpenAPIModelName() string {
	return OpenAPIPrefix + "UserPermissions"
}
