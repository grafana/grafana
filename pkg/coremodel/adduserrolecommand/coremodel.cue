package adduserrolecommand

import "github.com/grafana/thema"

thema.#Lineage
name: "adduserrolecommand"
seqs: [
	{
		schemas: [
			{
				global?:  bool
				roleUid?: string
			},
		]
	},
]
