// Code generated - EDITING IS FUTILE. DO NOT EDIT.
//
// Using jennies:
//     GoRawTypes

package accesspolicy

type AccessPolicy struct {
	// The scope where these policies should apply
	Scope ResourceRef `json:"scope"`
	// The role that must apply this policy
	Role RoleRef `json:"role"`
	// The set of rules to apply.  Note that * is required to modify
	// access policy rules, and that "none" will reject all actions
	Rules []AccessRule `json:"rules"`
}

type RoleRef struct {
	// Policies can apply to roles, teams, or users
	// Applying policies to individual users is supported, but discouraged
	Kind RoleRefKind `json:"kind"`
	Name string      `json:"name"`
	// temporary
	Xname string `json:"xname"`
}

type ResourceRef struct {
	// explicit resource or folder will cascade
	Kind string `json:"kind"`
	Name string `json:"name"`
}

type AccessRule struct {
	// The kind this rule applies to (dashboards, alert, etc)
	Kind string `json:"kind"`
	// READ, WRITE, CREATE, DELETE, ...
	// should move to k8s style verbs like: "get", "list", "watch", "create", "update", "patch", "delete"
	Verb string `json:"verb"`
	// Specific sub-elements like "alert.rules" or "dashboard.permissions"????
	Target *string `json:"target,omitempty"`
}

type RoleRefKind string

const (
	RoleRefKindRole        RoleRefKind = "Role"
	RoleRefKindBuiltinRole RoleRefKind = "BuiltinRole"
	RoleRefKindTeam        RoleRefKind = "Team"
	RoleRefKindUser        RoleRefKind = "User"
)
