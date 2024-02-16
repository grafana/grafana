// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoRawTypes

package rolebinding

type RoleBinding struct {
	// The role we are discussing
	Role BuiltinRoleRefOrCustomRoleRef `json:"role"`
	// The team or user that has the specified role
	Subject RoleBindingSubject `json:"subject"`
}

type CustomRoleRef struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
}

type BuiltinRoleRef struct {
	Kind string             `json:"kind"`
	Name BuiltinRoleRefName `json:"name"`
}

type RoleBindingSubject struct {
	Kind RoleBindingSubjectKind `json:"kind"`
	// The team/user identifier name
	Name string `json:"name"`
}

type BuiltinRoleRefName string

const (
	BuiltinRoleRefNameViewer BuiltinRoleRefName = "viewer"
	BuiltinRoleRefNameEditor BuiltinRoleRefName = "editor"
	BuiltinRoleRefNameAdmin  BuiltinRoleRefName = "admin"
)

type RoleBindingSubjectKind string

const (
	RoleBindingSubjectKindTeam RoleBindingSubjectKind = "Team"
	RoleBindingSubjectKindUser RoleBindingSubjectKind = "User"
)

type BuiltinRoleRefOrCustomRoleRef struct {
	BuiltinRoleRef *BuiltinRoleRef `json:"BuiltinRoleRef,omitempty"`
	CustomRoleRef  *CustomRoleRef  `json:"CustomRoleRef,omitempty"`
}
