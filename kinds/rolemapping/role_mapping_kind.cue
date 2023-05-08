package kind

name:        "RoleMapping"
maturity:    "merged"
description: "Public dashboard configuration"

lineage: seqs: [
	{
		schemas: [
			// 0.0
			{
				spec: {
					// k8s role name
					role: string
					// is the identity a user or team
					kind: "team" | "user"
					// the team/user k8s name
					identity: string
				} @cuetsy(kind="interface")
			},
		]
	},
]
