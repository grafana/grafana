package timerangedto

import "github.com/grafana/thema"

thema.#Lineage
name: "timerangedto"
seqs: [
	{
		schemas: [
			{
				from?: string
				to?:   string
			},
		]
	},
]
