package changeuserpasswordcommand

import "github.com/grafana/thema"

thema.#Lineage
name: "changeuserpasswordcommand"
seqs: [
	{
		schemas: [
			{
				newPassword?: string
				oldPassword?: string
			},
		]
	},
]
