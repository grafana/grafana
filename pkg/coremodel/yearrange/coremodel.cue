package yearrange

import "github.com/grafana/thema"

thema.#Lineage
name: "yearrange"
seqs: [
	{
		schemas: [
			{
				Begin?: int
				End?:   int
			},
		]
	},
]
