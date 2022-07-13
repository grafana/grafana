package peerstatus

import "github.com/grafana/thema"

thema.#Lineage
name: "peerstatus"
seqs: [
	{
		schemas: [
			{
				// address
				address: string

				// name
				name: string
			},
		]
	},
]
