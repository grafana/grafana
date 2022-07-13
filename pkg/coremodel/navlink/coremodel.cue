package navlink

import "github.com/grafana/thema"

thema.#Lineage
name: "navlink"
seqs: [
	{
		schemas: [
			{
				id?:     string
				target?: string
				text?:   string
				url?:    string
			},
		]
	},
]
