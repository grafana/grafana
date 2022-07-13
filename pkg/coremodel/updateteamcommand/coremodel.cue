package updateteamcommand

import "github.com/grafana/thema"

thema.#Lineage
name: "updateteamcommand"
seqs: [
	{
		schemas: [
			{
				Email?: string
				Id?:    int
				Name?:  string
			},
		]
	},
]
