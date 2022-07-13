package updatefoldercommand

import "github.com/grafana/thema"

thema.#Lineage
name: "updatefoldercommand"
seqs: [
	{
		schemas: [
			{
				overwrite?: bool
				title?:     string
				uid?:       string
				version?:   int
			},
		]
	},
]
