package faileduser

import "github.com/grafana/thema"

thema.#Lineage
name: "faileduser"
seqs: [
	{
		schemas: [
			{
				Error?: string
				Login?: string
			},
		]
	},
]
