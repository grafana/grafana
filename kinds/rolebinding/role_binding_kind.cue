package kind

name:        "RoleBinding"
maturity:    "merged"
description: "Role bindings link a set of subjects to a configured role"

lineage: seqs: [
	{
		schemas: [
			// 0.0
			{
				spec: {
					// The role we are discussing
					roleRef: #BuiltinRoleRef | #CustomRoleRef

					// The set of subjects who share the same role
					subjects: [...#RoleBindingSubject]
				} @cuetsy(kind="interface")

				#CustomRoleRef: {
					kind: "Role"
					name: string
				} @cuetsy(kind="interface")

				#BuiltinRoleRef: {
					kind: "BuiltinRole"
					name: "viewer" | "editor" | "admin"
				} @cuetsy(kind="interface")

				#RoleBindingSubject: {
					kind: "Team" | "User"

					// The team/user identifier name
					name: string
				} @cuetsy(kind="interface")
			},
		]
	},
]
