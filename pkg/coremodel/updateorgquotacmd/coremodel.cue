package updateorgquotacmd

import "github.com/grafana/thema"

thema.#Lineage
name: "updateorgquotacmd"
seqs: [
	{
		schemas: [
			{
				limit?:  int
				target?: string
			},
		]
	},
]
