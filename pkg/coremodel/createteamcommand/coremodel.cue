package createteamcommand

import "github.com/grafana/thema"

thema.#Lineage
name: "createteamcommand"
seqs: [
	{
		schemas: [
			{
				email?: string
				name?:  string
			},
		]
	},
]
