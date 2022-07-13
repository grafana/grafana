package datalink

import "github.com/grafana/thema"

thema.#Lineage
name: "datalink"
seqs: [
	{
		schemas: [
			{
				targetBlank?: bool
				title?:       string
				url?:         string
			},
		]
	},
]
