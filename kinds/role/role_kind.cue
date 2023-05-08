package kind

name:        "Role"
maturity:    "merged"
description: "Roles represent a set of users+teams that should share similar access"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				spec: {
					// The role identifier `managed:builtins:editor:permissions`
					name: string
					// Optional display
					displayName?: string
					// Name of the team.
					groupName?: string
					// Role description
					description?: string

					// Do not show this role
					hidden: bool | false
				} @cuetsy(kind="interface")
			},
		]
	},
]
