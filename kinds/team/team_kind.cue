package kind

name:        "Team"
maturity:    "merged"
description: "A team is a named grouping of Grafana users to which access control rules may be assigned."

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				spec: {
					// Name of the team.
					name: string
					// Email of the team.
					email?: string
				} @cuetsy(kind="interface")
			},
		]
	},
]
