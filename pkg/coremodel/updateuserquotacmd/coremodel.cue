package updateuserquotacmd

import "github.com/grafana/thema"

thema.#Lineage
name: "updateuserquotacmd"
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
