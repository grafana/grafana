package addinviteform

import "github.com/grafana/thema"

thema.#Lineage
name: "addinviteform"
seqs: [
	{
		schemas: [
			{
				loginOrEmail?: string
				name?:         string
				role?:         "Viewer" | "Editor" | "Admin"
				sendEmail?:    bool
			},
		]
	},
]
