package updateannotationscmd

import "github.com/grafana/thema"

thema.#Lineage
name: "updateannotationscmd"
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
