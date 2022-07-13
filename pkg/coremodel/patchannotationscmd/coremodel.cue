package patchannotationscmd

import "github.com/grafana/thema"

thema.#Lineage
name: "patchannotationscmd"
seqs: [
	{
		schemas: [
			{
				id?: int
				tags?: [...string]
				text?:    string
				time?:    int
				timeEnd?: int
			},
		]
	},
]
