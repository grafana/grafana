package kind

name:        "RoleBinding"
maturity:    "merged"
description: "Role bindings link a set of subjects to a configured role"

// ?? Writing a role binding requires "write" permission (or *)
// on the parent roleRef 

lineage: seqs: [
	{
		schemas: [
			// 0.0
			{
				spec: {
					// The role we are discussing
					roleRef: #BuiltinRoleRef | #CustomRoleRef

					// The set of subjects who share the same role
					// ??? this is a list in k8s... should it be in grafana?
					// as a list it implies that ability to edit a role+role_binding
					// meas you can see all the teams+users that use it.
					// -- is that OK, accurate?
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
