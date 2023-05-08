package kind

name:              "AccessPolicy"
maturity:          "merged"
description:       "Access rules for a scope+role.  NOTE there is a unique constraint on role+scope"
pluralName:        "AccessPolicies"
machineName:       "accesspolicy"
pluralMachineName: "accesspolicies"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				spec: {
					// The scope where these policies should apply
					scope: #ResourceID

					// The roles that must apply this policy 
					role: #RoleID

					// The set of rules to apply.  Note that * is required to modify
					// access policy rules, and that "none" will reject all actions
					rules: [...#AccessRule]
				} @cuetsy(kind="interface")

				#RoleID: {
					// Policies can apply to roles, teams, or users
					// Applying policies to individual users is supported, but discouraged
					kind: "role" | "team" | "user"
					uid:  string
				} @cuetsy(kind="interface")

				#ResourceID: {
					kind: string // explicit resource or folder will cascade
					uid:  string
				} @cuetsy(kind="interface")

				#AccessRule: {
					target: string                // dashboards, dashboards.permissions, alert.rules, ..
					action: "*" | "none" | string // READ, WRITE, CREATE, DELETE, ...
				}
			},
		]
	},
]
