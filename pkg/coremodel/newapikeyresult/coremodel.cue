package newapikeyresult

import "github.com/grafana/thema"

thema.#Lineage
name: "newapikeyresult"
seqs: [
	{
		schemas: [
			{
				id?:   int
				key?:  string
				name?: string
			},
		]
	},
]
