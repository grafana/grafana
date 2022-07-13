package timerange

import "github.com/grafana/thema"

thema.#Lineage
name: "timerange"
seqs: [
	{
		schemas: [
			{
				EndMinute?:   int
				StartMinute?: int
			},
		]
	},
]
