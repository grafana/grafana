package addorgusercommand

import "github.com/grafana/thema"

thema.#Lineage
name: "addorgusercommand"
seqs: [
	{
		schemas: [
			{
				loginOrEmail?: string
				role?:         "Viewer" | "Editor" | "Admin"
			},
		]
	},
]
