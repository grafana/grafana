package updateorgusercommand

import "github.com/grafana/thema"

thema.#Lineage
name: "updateorgusercommand"
seqs: [
	{
		schemas: [
			{
				role?: "Viewer" | "Editor" | "Admin"
			},
		]
	},
]
