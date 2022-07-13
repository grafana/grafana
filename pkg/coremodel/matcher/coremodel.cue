package matcher

import "github.com/grafana/thema"

thema.#Lineage
name: "matcher"
seqs: [
	{
		schemas: [
			{
				// is equal
				isEqual?: bool

				// is regex
				isRegex: bool

				// name
				name: string

				// value
				value: string
			},
		]
	},
]
