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
			//0.0
			{
				// UID for user/team/service...
				// ??? should this be a #ResourceID  but kind=user|team|???
				role: string

				// The entity this policy applies to
				scope: #ResourceID

				rules: [...#AccessRule]

				#ResourceID: {
					kind: string
					name: string
				} @cuetsy(kind="interface")

				#AccessRule: {
					what:   string // dashboards, dashboards.permissions, alert.rules, ...
					action: string // READ, WRITE, CREATE, DELETE, ...
				} @cuetsy(kind="interface")
			},
		]
	},
]
