package alertinstancesresponse

import "github.com/grafana/thema"

thema.#Lineage
name: "alertinstancesresponse"
seqs: [
	{
		schemas: [
			{
				// Instances is an array of arrow encoded dataframes
				// each frame has a single row, and a column for each instance
				// (alert identified by unique labels) with a boolean value
				// (firing/not firing)
				instances?: [...[...int]]
			},
		]
	},
]
