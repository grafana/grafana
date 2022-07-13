package hostport

import "github.com/grafana/thema"

thema.#Lineage
name: "hostport"
seqs: [
	{
		schemas: [
			{
				Host?: string
				Port?: string
			},
		]
	},
]
