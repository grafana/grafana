package silencestatus

import "github.com/grafana/thema"

thema.#Lineage
name: "silencestatus"
seqs: [
	{
		schemas: [
			{
				// state
				state: "[expired active pending]"
			},
		]
	},
]
