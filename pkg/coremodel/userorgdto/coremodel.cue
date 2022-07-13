package userorgdto

import "github.com/grafana/thema"

thema.#Lineage
name: "userorgdto"
seqs: [
	{
		schemas: [
			{
				name?:  string
				orgId?: int
				role?:  "Viewer" | "Editor" | "Admin"
			},
		]
	},
]
