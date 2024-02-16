// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoRawTypes

package role

type Role struct {
	// The role identifier `managed:builtins:editor:permissions`
	Name string `json:"name"`
	// Optional display
	DisplayName *string `json:"displayName,omitempty"`
	// Name of the team.
	GroupName *string `json:"groupName,omitempty"`
	// Role description
	Description *string `json:"description,omitempty"`
	// Do not show this role
	Hidden bool `json:"hidden"`
}
