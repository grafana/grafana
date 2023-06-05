package kind

name:              "AccessPolicy"
maturity:          "merged"
description:       "Access rules for a scope+role.  NOTE there is a unique constraint on role+scope"
pluralName:        "AccessPolicies"
machineName:       "accesspolicy"
pluralMachineName: "accesspolicies"

lineage: schemas: [{
	version: [0, 0]
	schema: {
		spec: {
			// The scope where these policies should apply
			scope: #ResourceRef

			// The role that must apply this policy 
			role: #RoleRef

			// The set of rules to apply.  Note that * is required to modify
			// access policy rules, and that "none" will reject all actions
			rules: [...#AccessRule]
		} @cuetsy(kind="interface")

		#RoleRef: {
			// Policies can apply to roles, teams, or users
			// Applying policies to individual users is supported, but discouraged
			kind:  "Role" | "BuiltinRole" | "Team" | "User"
			name:  string
			xname: string // temporary
		} @cuetsy(kind="interface")

		#ResourceRef: {
			kind: string // explicit resource or folder will cascade
			name: string
		} @cuetsy(kind="interface")

		#AccessRule: {
			// The kind this rule applies to (dashboars, alert, etc)
			kind: "*" | string

			// READ, WRITE, CREATE, DELETE, ...
			// should move to k8s style verbs like: "get", "list", "watch", "create", "update", "patch", "delete" 
			verb: "*" | "none" | string

			// Specific sub-elements like "alert.rules" or "dashboard.permissions"????
			target?: string
		} @cuetsy(kind="interface")
	}
},
]
