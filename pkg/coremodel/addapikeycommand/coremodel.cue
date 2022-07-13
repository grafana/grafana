package addapikeycommand

import "github.com/grafana/thema"

thema.#Lineage
name: "addapikeycommand"
seqs: [
	{
		schemas: [
			{
				name?:          string
				role?:          "Viewer" | "Editor" | "Admin"
				secondsToLive?: int
			},
		]
	},
]
