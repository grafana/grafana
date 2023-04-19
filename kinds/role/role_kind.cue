package kind

name:        "Role"
maturity:    "merged"
description: "Authz Role definition"

lineage: seqs: [
	{
		schemas: [
			//0.0
			{
				// Namespace aka tenant/org id.
				namespace: string

				// Unique role uid.
				uid: string

				// Role internal name.
				id: string

				// Role display name.
				title: string

				// Role group name
				groupName: string

				// Description of the role.
				description?: string

				version: string

				hidden: bool
			},
		]
	},
]
